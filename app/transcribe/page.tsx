import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TranscribeClient } from "@/components/transcribe/TranscribeClient";
import { uploadLimit } from "@/lib/transcribe/shared";
import styles from "@/components/transcribe/Transcribe.module.css";

const title = "Расшифровка аудио и видео онлайн с помощью AI | ARGO";
const description = "Онлайн-расшифровка аудио и видео в текст с таймкодами. MP3, WAV, M4A, MP4, MOV и другие форматы. AI-сервис ARGO Transcribe.";
export const metadata: Metadata = { title, description, alternates: { canonical: "/transcribe" }, openGraph: { title, description, url: "/transcribe", type: "website", locale: "ru_RU", siteName: "ARGO SOFT" } };
export const dynamic = "force-dynamic";
export default function TranscribePage() {
  const maxUploadMB = uploadLimit(process.env.MAX_UPLOAD_SIZE_MB || process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB);
  return <><Header /><main className={styles.page} id="top"><div className="container">
    <div className={styles.intro}><span className="kicker">ARGO TRANSCRIBE · АУДИО → ТЕКСТ</span><h1>Расшифровка аудио<br />и видео <span className="gradient-text">онлайн</span></h1><p className={styles.lead}>Превратите встречу, лекцию, интервью или видеозапись в структурированный текст с таймкодами.</p><ul className={styles.benefits}>{["Локальная AI-обработка", "Русский и другие языки", "Таймкоды", "Экспорт TXT / SRT / VTT", "Без ручного переслушивания"].map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul></div>
    <TranscribeClient maxUploadMB={maxUploadMB} />
    <section className={styles.seo} aria-label="О сервисе">
      <div><h2>Что такое расшифровка аудио</h2><p>Это преобразование речи в текст. ARGO Transcribe помогает работать с записями встреч, лекций и интервью: читать содержание и переходить к нужному моменту по таймкоду. Точность зависит от качества звука — важные имена и числа стоит проверить.</p></div>
      <div><h2>Какие форматы поддерживаются</h2><p>Загрузите MP3, WAV, M4A, AAC, OGG, FLAC, MP4, MOV, WEBM или MKV. Сервис извлечёт звуковую дорожку и определит язык автоматически. Запись обрабатывается на сервере ARGO; временные файлы удаляются после завершения обработки.</p></div>
      <div><h2>Как получить субтитры из видео</h2><p>Выберите видеозапись и дождитесь расшифровки. На вкладке «Субтитры» скачайте SRT для видеоредактора или VTT для веб-плеера. Текст без таймкодов можно скопировать или сохранить в TXT.</p></div>
    </section>
  </div></main><Footer /></>;
}
