export const mediaFormats = {
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  m4a: ["audio/mp4", "audio/x-m4a", "video/mp4"],
  aac: ["audio/aac", "audio/x-aac"],
  ogg: ["audio/ogg", "video/ogg", "application/ogg"],
  flac: ["audio/flac", "audio/x-flac"],
  mp4: ["video/mp4", "audio/mp4"],
  mov: ["video/quicktime"],
  webm: ["video/webm", "audio/webm"],
  mkv: ["video/x-matroska", "audio/x-matroska"],
} as const;
export const extensions = Object.keys(mediaFormats);
export const fileAccept = extensions.map((ext) => `.${ext}`).join(",");
export const DEFAULT_UPLOAD_MB = 500;
export function uploadLimit(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : DEFAULT_UPLOAD_MB;
}
export function mediaExtension(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }
export function validMedia(name: string, mime: string) {
  const ext = mediaExtension(name);
  const allowed = mediaFormats[ext as keyof typeof mediaFormats] as readonly string[] | undefined;
  // Browsers often send empty/octet-stream for MKV and other uncommon containers.
  // These still require an approved extension and real FFprobe validation in Python.
  return !!allowed && (!mime || mime === "application/octet-stream" || allowed.includes(mime.toLowerCase()));
}
export type Segment = { id: number; start: number; end: number; text: string; speaker?: string };
export type Transcript = {
  text: string; language: string; language_probability: number; duration: number; segments: Segment[];
};
export type Stage = "uploading" | "queued" | "extracting" | "transcribing" | "formatting";
export type TranscribeProgress = { type: "progress"; processed_seconds: number; duration: number };
export type TranscribeEvent = { type: "stage"; stage: Stage } | { type: "heartbeat" }
  | TranscribeProgress | { type: "result"; result: Transcript } | { type: "error"; error: string };
export function isTranscribeProgress(value: unknown): value is TranscribeProgress {
  if (!value || typeof value !== "object") return false;
  const p = value as TranscribeProgress;
  return p.type === "progress" && Number.isFinite(p.duration) && p.duration > 0
    && Number.isFinite(p.processed_seconds) && p.processed_seconds >= 0 && p.processed_seconds <= p.duration;
}
export function isTranscript(value: unknown): value is Transcript {
  if (!value || typeof value !== "object") return false;
  const r = value as Transcript;
  return typeof r.text === "string" && typeof r.language === "string"
    && Number.isFinite(r.duration) && r.duration >= 0
    && Number.isFinite(r.language_probability) && r.language_probability >= 0 && r.language_probability <= 1
    && Array.isArray(r.segments) && r.segments.every((s) => s && Number.isInteger(s.id)
      && Number.isFinite(s.start) && s.start >= 0 && Number.isFinite(s.end) && s.end >= s.start
      && typeof s.text === "string");
}
export function timestamp(seconds: number, separator?: "," | ".") {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor(ms / 60000) % 60;
  const secs = Math.floor(ms / 1000) % 60;
  const base = [hours, minutes, secs].map((v) => String(v).padStart(2, "0")).join(":");
  return separator ? `${base}${separator}${String(ms % 1000).padStart(3, "0")}` : base;
}
function subtitleText(text: string) {
  return text.replace(/\r/g, "").replace(/\n\s*\n/g, "\n").replace(/-->/g, "→").trim();
}
export function toSrt(segments: Segment[]) {
  return segments.map((s, i) => `${i + 1}\n${timestamp(s.start, ",")} --> ${timestamp(s.end, ",")}\n${subtitleText(s.text)}\n`).join("\n");
}
export function toVtt(segments: Segment[]) {
  return "WEBVTT\n\n" + segments.map((s) => `${timestamp(s.start, ".")} --> ${timestamp(s.end, ".")}\n${subtitleText(s.text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}\n`).join("\n");
}
export function toTxt(result: Transcript, filename: string, date: Date) {
  return `Файл: ${filename}\nДата обработки: ${date.toISOString()}\nЯзык: ${result.language}\n\n${result.text}\n`;
}
