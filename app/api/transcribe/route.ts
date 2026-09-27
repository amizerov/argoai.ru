import { mkdtemp, rm } from "node:fs/promises";
import { openAsBlob } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { receiveUpload, UploadError } from "../../../lib/transcribe/upload.ts";
import { isTranscript, isTranscribeProgress, uploadLimit, type TranscribeEvent } from "../../../lib/transcribe/shared.ts";

export const runtime = "nodejs";
let active = 0;
const genericError = "Не удалось обработать файл. Попробуйте другой формат или файл меньшего размера.";
const stages = new Set(["queued", "extracting", "transcribing", "formatting"]);
function setting(name: string, fallback: number) {
  const n = Number(process.env[name]); return Number.isInteger(n) && n > 0 ? n : fallback;
}

export async function POST(request: Request) {
  const maxBytes = uploadLimit(process.env.MAX_UPLOAD_SIZE_MB || process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB) * 1024 * 1024;
  if (active >= setting("TRANSCRIBE_MAX_REQUESTS", 3)) {
    return Response.json({ error: "Сервис занят. Попробуйте через несколько минут." }, { status: 429, headers: { "Retry-After": "60" } });
  }
  active++;
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const timer = setTimeout(abort, setting("TRANSCRIBE_TIMEOUT_SECONDS", 3600) * 1000);
  let directory: string | undefined;
  let cleaned = false;
  async function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    try { if (directory) await rm(directory, { recursive: true, force: true }); }
    finally { active--; }
  }
  try {
    directory = await mkdtemp(join(tmpdir(), "argo-upload-"));
    const file = await receiveUpload(request, directory, maxBytes, controller.signal);
    const form = new FormData();
    form.set("file", await openAsBlob(file.path, { type: file.mime }), file.name);
    if (file.language) form.set("language", file.language);
    const serviceUrl = new URL(process.env.TRANSCRIBE_SERVICE_URL || "http://127.0.0.1:8100");
    if (!['127.0.0.1', '[::1]', 'localhost'].includes(serviceUrl.hostname) || serviceUrl.protocol !== "http:") {
      throw new Error("Speech service must use loopback HTTP");
    }
    const streaming = request.headers.get("accept")?.includes("application/x-ndjson");
    const upstream = await fetch(new URL("/transcribe", serviceUrl), {
      method: "POST", body: form, signal: controller.signal,
      headers: { Accept: streaming ? "application/x-ndjson" : "application/json" },
    });
    if (!upstream.ok || !upstream.body) {
      const status = [400, 413, 415, 422, 429, 503, 504].includes(upstream.status) ? upstream.status : 502;
      await upstream.body?.cancel();
      throw new UploadError(status === 429 ? "Сервис занят. Попробуйте через несколько минут." : genericError, status);
    }
    if (!streaming) {
      const result: unknown = await upstream.json();
      if (!isTranscript(result)) throw new Error("Invalid speech response");
      await cleanup();
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    const reader = upstream.body.getReader();
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream({
      async start(output) {
        const emit = (event: TranscribeEvent) => { if (!cancelled) output.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
        let complete = false;
        try {
          let pending = "";
          const decoder = new TextDecoder();
          while (!complete) {
            const { done, value } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            if (pending.length > 10_000_000) throw new Error("Speech result too large");
            let index;
            while ((index = pending.indexOf("\n")) >= 0) {
              const line = pending.slice(0, index); pending = pending.slice(index + 1);
              if (!line.trim()) continue;
              const event = JSON.parse(line);
              if (event.type === "stage" && stages.has(event.stage)) emit({ type: "stage", stage: event.stage });
              else if (isTranscribeProgress(event)) emit({ type: "progress", processed_seconds: event.processed_seconds, duration: event.duration });
              else if (event.type === "heartbeat") emit({ type: "heartbeat" });
              else if (event.type === "result" && isTranscript(event.result)) {
                emit({ type: "result", result: event.result }); complete = true;
              } else if (event.type === "error") {
                emit({ type: "error", error: genericError }); complete = true;
              } else throw new Error("Invalid speech event");
            }
          }
          if (!complete) throw new Error("Speech stream interrupted");
        } catch {
          emit({ type: "error", error: controller.signal.aborted ? "Время обработки истекло. Попробуйте более короткую запись." : genericError });
        } finally {
          await reader.cancel().catch(() => {});
          await cleanup();
          if (!cancelled) output.close();
        }
      },
      cancel() { cancelled = true; controller.abort(); },
    });
    return new Response(stream, { headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no",
    } });
  } catch (error) {
    await cleanup();
    return Response.json({ error: error instanceof UploadError ? error.message
      : controller.signal.aborted ? "Время обработки истекло. Попробуйте более короткую запись."
      : "Сервис распознавания временно недоступен. Попробуйте позже." }, {
      status: error instanceof UploadError ? error.status : controller.signal.aborted ? 504 : 503,
    });
  }
}
