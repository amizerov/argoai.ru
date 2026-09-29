"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Clock3, Download, FileAudio, UploadCloud } from "lucide-react";
import { extensions, fileAccept, isTranscript, isTranscribeProgress, mediaExtension, mediaFormats, timestamp, toSrt, toTxt, toVtt, validMedia, type Stage, type Transcript, type TranscribeProgress } from "@/lib/transcribe/shared";
import styles from "./Transcribe.module.css";

const labels: Record<Stage, string> = { uploading: "Загружаем файл", queued: "Ожидаем свободный слот", extracting: "Извлекаем аудио", transcribing: "Распознаём речь", formatting: "Формируем результат" };
const steps: Stage[] = ["uploading", "extracting", "transcribing", "formatting"];
const tabs = ["Расшифровка", "Текст", "Субтитры"];

export function TranscribeClient({ maxUploadMB }: { maxUploadMB: number }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const player = useRef<HTMLMediaElement | null>(null);
  const objectUrl = useRef("");
  const controller = useRef<AbortController | null>(null);
  const startTime = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [media, setMedia] = useState<{ url: string; video: boolean; playable: boolean } | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [language, setLanguage] = useState("ru");
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastServerEvent, setLastServerEvent] = useState<number | null>(null);
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);
  const [result, setResult] = useState<Transcript | null>(null);
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const busy = stage !== null;
  const waitingForFirst = stage === "transcribing" && (!progress || progress.processed_seconds === 0);
  const statusLabel = waitingForFirst ? "Распознаём первый фрагмент" : stage ? labels[stage] : "";
  const serverSilence = lastServerEvent === null ? elapsed : Math.max(0, elapsed - lastServerEvent);
  const percent = stage === "formatting" ? 100 : stage === "transcribing" && progress && !waitingForFirst
    ? Math.min(99, Math.floor(progress.processed_seconds / progress.duration * 100)) : null;
  useEffect(() => () => { controller.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  function selectFile(selected: File | undefined) {
    if (!selected || busy) return;
    setError("");
    if (!validMedia(selected.name, selected.type)) { setError("Формат не поддерживается. Выберите аудио или видео из списка."); return; }
    if (!selected.size) { setError("Файл пустой. Выберите другую запись."); return; }
    if (selected.size > maxUploadMB * 1024 * 1024) { setError(`Максимальный размер файла — ${maxUploadMB} МБ.`); return; }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(selected);
    const ext = mediaExtension(selected.name) as keyof typeof mediaFormats;
    const video = ["mp4", "mov", "webm", "mkv"].includes(ext) && !selected.type.startsWith("audio/");
    const element = document.createElement(video ? "video" : "audio");
    const mime = selected.type && selected.type !== "application/octet-stream" ? selected.type : mediaFormats[ext][0];
    setMedia({ url: objectUrl.current, video, playable: !!element.canPlayType(mime) });
    setFile(selected); setDuration(null); setResult(null); setCompletedAt(null); setTab(0); setCopyStatus("");
  }
  async function transcribe() {
    if (!file || controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    startTime.current = Date.now(); setElapsed(0); setLastServerEvent(null); setProgress(null); setStage("uploading"); setError(""); setResult(null); setCopyStatus("");
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const form = new FormData(); form.set("file", file); if (language) form.set("language", language);
      const response = await fetch("/api/transcribe", { method: "POST", body: form, signal: abort.signal, headers: { Accept: "application/x-ndjson" } });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 413) throw new Error(typeof body.error === "string" ? body.error
          : "Сервер отклонил файл из-за ограничения размера загрузки. Попробуйте файл меньшего размера.");
        throw new Error(typeof body.error === "string" ? body.error : "Не удалось загрузить файл. Попробуйте позже.");
      }
      if (!response.body) throw new Error("Соединение с сервисом прервано.");
      reader = response.body.getReader(); const decoder = new TextDecoder();
      let pending = ""; let complete = false;
      while (!complete) {
        const { value, done } = await reader.read(); if (done) break;
        pending += decoder.decode(value, { stream: true });
        if (pending.length > 10_000_000) throw new Error("Результат слишком большой. Разделите запись на части.");
        let newline;
        while ((newline = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, newline); pending = pending.slice(newline + 1); if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "heartbeat" || event.type === "stage" || isTranscribeProgress(event)) {
            setLastServerEvent(Math.floor((Date.now() - startTime.current) / 1000));
          }
          if (event.type === "stage" && Object.hasOwn(labels, event.stage)) setStage(event.stage);
          if (isTranscribeProgress(event)) setProgress((previous) => previous && previous.duration === event.duration
            ? { ...event, processed_seconds: Math.max(previous.processed_seconds, event.processed_seconds) } : event);
          if (event.type === "error") throw new Error(event.error || "Не удалось обработать запись.");
          if (event.type === "result" && isTranscript(event.result)) { setResult(event.result); setCompletedAt(new Date()); setTab(0); complete = true; }
        }
      }
      if (!complete) throw new Error("Соединение прервалось. Попробуйте отправить запись ещё раз.");
    } catch (err) {
      setError(abort.signal.aborted ? "Загрузка или обработка отменена." : err instanceof Error ? err.message : "Не удалось обработать запись.");
    } finally { await reader?.cancel().catch(() => {}); controller.current = null; setStage(null); }
  }
  function download(kind: "txt" | "srt" | "vtt") {
    if (!result || !file || !completedAt) return;
    const text = kind === "txt" ? toTxt(result, file.name, completedAt) : kind === "srt" ? toSrt(result.segments) : toVtt(result.segments);
    const url = URL.createObjectURL(new Blob([text], { type: kind === "vtt" ? "text/vtt;charset=utf-8" : "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${file.name.replace(/\.[^.]+$/, "")}.${kind}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(result?.text ?? ""); setCopyStatus("Скопировано"); }
    catch { setCopyStatus("Не удалось скопировать. Выделите текст и скопируйте вручную."); }
  }
  return <section className={styles.workspace} aria-label="Расшифровка записи">
    <input ref={input} type="file" accept={fileAccept} hidden aria-label="Выбрать аудио или видео" onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ""; }} />
    {!result && <>
      <div className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
        onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length > 1) setError("Выберите один файл за раз."); else selectFile(event.dataTransfer.files[0]); }}>
        <UploadCloud size={44} strokeWidth={1.3} aria-hidden="true" /><h2>Перетащите аудио или видео сюда</h2>
        <p>{extensions.map((ext) => ext.toUpperCase()).join(" · ")}</p>
        <button className="button" type="button" disabled={busy} onClick={() => input.current?.click()}>Выбрать файл</button>
        <small>До {maxUploadMB} МБ · Обработка на сервере ARGO</small>
      </div>
      {file && <div className={styles.selection}>
        <div className={styles.fileInfo}><FileAudio aria-hidden="true" /><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(1)} МБ · {mediaExtension(file.name).toUpperCase()}{duration !== null ? ` · ${timestamp(duration)}` : ""}</span></div></div>
        <label className={styles.language}>Язык записи<select value={language} disabled={busy} onChange={(event) => setLanguage(event.target.value)}>
          <option value="">Определить автоматически</option><option value="ru">Русский</option><option value="en">Английский</option><option value="de">Немецкий</option><option value="fr">Французский</option><option value="es">Испанский</option><option value="zh">Китайский</option>
        </select><small>Выберите язык записи, чтобы пропустить его автоопределение.</small></label>
        {!busy && <button type="button" className="button" onClick={transcribe}>Начать расшифровку <span aria-hidden="true">↗</span></button>}
      </div>}
    </>}
    {busy && <div className={styles.progress} aria-busy="true">
      <div className={styles.progressHead}><strong role="status">{statusLabel}{percent !== null && ` · ${percent}%`}</strong><span><Clock3 size={15} /> Прошло {timestamp(elapsed)}</span></div>
      <div className={`${styles.progressTrack} ${percent === null ? styles.waiting : ""}`} role="progressbar" aria-label={statusLabel}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? statusLabel : `${percent}%${progress ? `, обработано ${timestamp(progress.processed_seconds)} из ${timestamp(progress.duration)}` : ""}`}>
        <div className={styles.progressFill} style={percent !== null ? { width: `${percent}%` } : undefined} />
      </div>
      {progress && (stage === "transcribing" || stage === "formatting") && <p className={styles.progressDetail}>{waitingForFirst
        ? `Длительность записи: ${timestamp(progress.duration)}. Текст ещё не получен.`
        : `Обработано ${timestamp(progress.processed_seconds)} из ${timestamp(progress.duration)} записи`}</p>}
      {lastServerEvent !== null && <p className={styles.progressDetail}>{serverSilence >= 30
        ? `Нет новых сообщений от сервера ${serverSilence} с. Соединение может задерживаться.`
        : `Соединение с сервером активно · последнее сообщение ${serverSilence} с назад`}</p>}
      <ol>{steps.map((step, i) => <li key={step} className={steps.indexOf(stage) >= i || (stage === "queued" && i === 0) ? styles.activeStep : ""}>{String(i + 1).padStart(2, "0")} {labels[step]}</li>)}</ol>
      <p>{stage === "transcribing"
        ? elapsed >= 30 && (!progress || progress.processed_seconds === 0)
          ? "Ожидаем первый распознанный фрагмент. Даже короткая запись может обрабатываться несколько минут. Текст появится после завершения — дождитесь результата на этой странице."
          : "Прогресс обновляется после каждого распознанного фрагмента. Для короткой записи текст может появиться сразу целиком."
        : stage === "queued" ? "Запись в очереди. Распознавание начнётся, когда освободится сервер." : "Дождитесь результата на этой странице."}</p>
      <button type="button" className={styles.secondary} onClick={() => controller.current?.abort()}>Отменить</button>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {result && <div className={styles.resultHead}><span className={styles.ready}><Check size={18} /> Готово</span><h2>Расшифровка готова</h2><p className={styles.filename}>{file?.name}</p><div className={styles.facts}><span>Язык: {result.language.toUpperCase()}</span><span>{timestamp(result.duration)}</span><span>Сегментов: {result.segments.length}</span></div></div>}
    {media?.playable && <div className={styles.player}>
      {media.video ? <video ref={(node) => { player.current = node; }} src={media.url} controls preload="metadata" playsInline
        onLoadedMetadata={(event) => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); }} onError={() => setMedia((current) => current ? { ...current, playable: false } : current)} />
        : <audio ref={(node) => { player.current = node; }} src={media.url} controls preload="metadata"
          onLoadedMetadata={(event) => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); }} onError={() => setMedia((current) => current ? { ...current, playable: false } : current)} />}
    </div>}
    {media && !media.playable && <p className={styles.note}>Браузер не поддерживает воспроизведение этого формата. Файл можно расшифровать и скачать текст.</p>}
    {result && <div className={styles.result}>
      <div role="tablist" aria-label="Вид результата" className={styles.tabs}>{tabs.map((name, index) => <button key={name} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={tab === index} tabIndex={tab === index ? 0 : -1}
        onClick={() => setTab(index)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
          setTab(next); document.getElementById(`${id}-tab-${next}`)?.focus();
        }}>{name}</button>)}</div>
      <div role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-tab-${tab}`} tabIndex={0} className={styles.tabpanel}>
        {tab === 0 && (result.segments.length ? <div className={styles.segments}>{result.segments.map((segment) => <div className={styles.segment} key={segment.id}><button type="button" disabled={!media?.playable} aria-label={`Перейти к ${timestamp(segment.start)}`} onClick={() => { if (player.current) { player.current.currentTime = segment.start; void player.current.play().catch(() => {}); } }}>{timestamp(segment.start)}</button><p>{segment.text}</p></div>)}</div> : <p>Речь в записи не обнаружена. Попробуйте запись с более отчётливым звуком.</p>)}
        {tab === 1 && <><div className={styles.actions}><button type="button" className={styles.secondary} onClick={copy}>Скопировать</button><button type="button" className={styles.secondary} onClick={() => download("txt")}><Download size={16} /> Скачать TXT</button></div><p role="status" className={styles.note}>{copyStatus}</p><p className={styles.fullText}>{result.text || "Речь в записи не обнаружена."}</p></>}
        {tab === 2 && <><div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => download("srt")}><Download size={16} /> Скачать SRT</button><button type="button" className={styles.secondary} onClick={() => download("vtt")}><Download size={16} /> Скачать VTT</button></div><pre className={styles.subtitles}>{toSrt(result.segments) || "В записи нет распознанных сегментов."}</pre></>}
      </div>
      <div className={styles.bottomActions}><button className="button" type="button" onClick={() => input.current?.click()}>Расшифровать другой файл</button><span>Сохраните результат: история записей не хранится.</span></div>
    </div>}
  </section>;
}
