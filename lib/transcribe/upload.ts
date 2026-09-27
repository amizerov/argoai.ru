import busboy from "busboy";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { mediaExtension, validMedia } from "./shared.ts";

export class UploadError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export async function receiveUpload(request: Request, directory: string, maxBytes: number, signal: AbortSignal) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new UploadError("Выберите аудио или видео.", 415);
  if (Number(request.headers.get("content-length")) > maxBytes + 65536) throw new UploadError("Файл превышает допустимый размер.", 413);
  if (!request.body) throw new UploadError("Файл не получен.");
  let parser;
  try {
    parser = busboy({ headers: { "content-type": request.headers.get("content-type")! }, limits: {
      files: 1, fields: 1, parts: 3, fileSize: maxBytes + 1, fieldSize: 32,
    } });
  } catch { throw new UploadError("Некорректная загрузка файла."); }
  let file: { path: string; name: string; mime: string } | undefined;
  let language = "";
  let failure: Error | undefined;
  const writes: Promise<void>[] = [];
  parser.on("file", (field, stream, info) => {
    if (field !== "file" || !validMedia(info.filename, info.mimeType)) {
      failure = new UploadError("Формат не поддерживается. Выберите аудио или видео из списка.", 415);
      stream.resume(); return;
    }
    const ext = mediaExtension(info.filename);
    file = { path: join(/* turbopackIgnore: true */ directory, `${randomUUID()}.${ext}`), name: `recording.${ext}`, mime: info.mimeType };
    let bytes = 0;
    stream.on("data", (chunk: Buffer) => { bytes += chunk.length; });
    stream.on("limit", () => { failure = new UploadError("Файл превышает допустимый размер.", 413); });
    const write = pipeline(stream, createWriteStream(file.path, { flags: "wx", mode: 0o600 }), { signal })
      .then(() => { if (!bytes) failure = new UploadError("Файл пустой."); else if (bytes > maxBytes) failure = new UploadError("Файл превышает допустимый размер.", 413); })
      .catch((error: Error) => { failure ??= error; });
    writes.push(write);
  });
  parser.on("field", (field, value, info) => {
    if (field !== "language" || info.valueTruncated || (value && !/^[a-z]{2,3}$/.test(value))) {
      failure = new UploadError("Некорректный язык записи.");
    } else language = value;
  });
  for (const event of ["filesLimit", "fieldsLimit", "partsLimit"] as const) {
    parser.on(event, () => { failure = new UploadError("Загрузите один файл за раз."); });
  }
  let bytes = 0;
  const limiter = new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length;
    callback(bytes > maxBytes + 65536 ? new UploadError("Файл превышает допустимый размер.", 413) : null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(request.body as import("node:stream/web").ReadableStream), limiter, parser, { signal });
  } catch (error) { failure ??= error instanceof UploadError ? error : new UploadError("Загрузка прервана или файл повреждён."); }
  await Promise.all(writes);
  if (failure) throw failure;
  if (!file) throw new UploadError("Выберите файл.");
  return { ...file, language };
}
