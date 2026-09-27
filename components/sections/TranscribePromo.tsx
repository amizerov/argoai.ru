import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import styles from "@/components/transcribe/Transcribe.module.css";
export function TranscribePromo() {
  return <aside className={styles.promo} aria-label="Попробуйте ARGO Transcribe"><div><h3>ARGO Transcribe</h3><p>Расшифровывайте встречи, лекции, интервью и видео с помощью локальной AI-модели.</p></div><Link href="/transcribe" className="button">Попробовать бесплатно <ArrowUpRight size={17} /></Link></aside>;
}
