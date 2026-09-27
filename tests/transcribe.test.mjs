import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { timestamp, toSrt, toVtt, toTxt, validMedia, uploadLimit } from "../lib/transcribe/shared.ts";
import { receiveUpload } from "../lib/transcribe/upload.ts";
import { POST } from "../app/api/transcribe/route.ts";

test("subtitle timecodes carry milliseconds into seconds, minutes and hours", () => {
  assert.equal(timestamp(59.9996, ","), "00:01:00,000");
  assert.equal(timestamp(3600.125, "."), "01:00:00.125");
  const segments = [{ id: 7, start: 0, end: 4.5, text: "Привет <мир>" }];
  assert.equal(toSrt(segments), "1\n00:00:00,000 --> 00:00:04,500\nПривет <мир>\n");
  assert.equal(toVtt(segments), "WEBVTT\n\n00:00:00.000 --> 00:00:04.500\nПривет &lt;мир&gt;\n");
  assert.match(toTxt({ text: "Привет", language: "ru" }, "meeting.mp4", new Date("2026-09-27T00:00:00Z")), /meeting.mp4\nДата обработки: 2026-09-27T00:00:00.000Z\nЯзык: ru\n\nПривет/);
});
test("format and limit validation", () => {
  assert.equal(validMedia("a.MP3", "audio/mpeg"), true);
  assert.equal(validMedia("a.mkv", "application/octet-stream"), true);
  assert.equal(validMedia("a.exe", "audio/mpeg"), false);
  assert.equal(validMedia("a.mp3", "text/html"), false);
  assert.equal(uploadLimit("12"), 12);
  assert.equal(uploadLimit("-1"), 500);
});
async function withUpload(fields, limit, run) {
  const dir = await mkdtemp(join(tmpdir(), "argo-test-"));
  try {
    const form = new FormData();
    for (const [key, value, name] of fields) { if (name) form.append(key, value, name); else form.append(key, value); }
    const request = new Request("http://localhost/api/transcribe", { method: "POST", body: form });
    await run(() => receiveUpload(request, dir, limit, new AbortController().signal), dir);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
test("upload writes a UUID filename and preserves bytes without trusting paths", async () => {
  await withUpload([["file", new Blob(["test bytes"], { type: "audio/wav" }), "../../private.wav"], ["language", "ru"]], 100, async (receive, dir) => {
    const file = await receive(); assert.equal(file.language, "ru");
    assert.match((await readdir(dir))[0], /^[a-f0-9-]+\.wav$/);
    assert.equal(await readFile(file.path, "utf8"), "test bytes");
  });
});
test("upload rejects unsupported, oversized, multiple and empty files", async () => {
  for (const [fields, limit, status] of [
    [[["file", new Blob(["bad"], { type: "text/html" }), "a.mp3"]], 100, 415],
    [[["file", new Blob(["123456"], { type: "audio/wav" }), "a.wav"]], 5, 413],
    [[["file", new Blob([], { type: "audio/wav" }), "a.wav"]], 100, 400],
    [[["file", new Blob(["x"]), "a.wav"], ["file", new Blob(["x"]), "b.wav"]], 100, 400],
  ]) await withUpload(fields, limit, async (receive) => { await assert.rejects(receive, (error) => error.status === status); });
});

test("Next streams validated progress before the result and strips extra upstream fields", async (t) => {
  const result = { text: "Тест", language: "ru", language_probability: 1, duration: 60, segments: [] };
  const events = [{ type: "stage", stage: "transcribing" },
    { type: "progress", processed_seconds: 15, duration: 60, internal: "private" },
    { type: "progress", processed_seconds: 60, duration: 60 },
    { type: "result", result }];
  t.mock.method(globalThis, "fetch", async () => new Response(events.map(e => JSON.stringify(e)).join("\n") + "\n"));
  const form = new FormData();
  form.set("file", new Blob(["audio"], { type: "audio/wav" }), "test.wav");
  const response = await POST(new Request("http://localhost/api/transcribe", {
    method: "POST", body: form, headers: { Accept: "application/x-ndjson" },
  }));
  const received = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
  assert.equal(response.status, 200);
  assert.deepEqual(received[1], { type: "progress", processed_seconds: 15, duration: 60 });
  assert.deepEqual(received.at(-1), { type: "result", result });
});

test("Next rejects impossible upstream progress safely", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    type: "progress", processed_seconds: 120, duration: 60,
  }) + "\n"));
  const form = new FormData();
  form.set("file", new Blob(["audio"], { type: "audio/wav" }), "test.wav");
  const response = await POST(new Request("http://localhost/api/transcribe", {
    method: "POST", body: form, headers: { Accept: "application/x-ndjson" },
  }));
  assert.equal(JSON.parse((await response.text()).trim()).type, "error");
});
