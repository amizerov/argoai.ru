"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, X } from "lucide-react";
import styles from "./ContactFormButton.module.css";

type ContactFormButtonProps = {
  label?: string;
  className?: string;
  topic?: "project" | "1c";
  onOpen?: () => void;
};

export function ContactFormButton({
  label = "Обсудить проект",
  className = "button",
  topic = "project",
  onOpen,
}: ContactFormButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    modal?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      modal?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function close() {
    if (!sending.current) setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setStatus("sending");
    setError("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(fields), topic }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        throw new Error(typeof result.error === "string" ? result.error : "Не удалось отправить заявку. Попробуйте ещё раз.");
      }
      form.reset();
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error && !(err instanceof TypeError)
        ? err.message
        : "Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.");
      setStatus("error");
    } finally {
      sending.current = false;
    }
  }

  return (
    <>
      <button type="button" className={`${className} ${styles.trigger}`} onClick={() => { setStatus("idle"); setError(""); setOpen(true); onOpen?.(); }}>
        {label} <ArrowUpRight size={17} aria-hidden="true" />
      </button>
      {open && createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClose={() => setOpen(false)}
      >
        <button type="button" className={styles.close} aria-label="Закрыть форму" onClick={close} disabled={status === "sending"}><X size={22} /></button>
        <h2 id={`${id}-title`} className={styles.title}>Обсудим вашу задачу</h2>
        {status === "success" ? (
          <div className={styles.success} role="status">
            <Check size={32} aria-hidden="true" />
            <p>Заявка отправлена. Ответим на указанный email.</p>
            <button type="button" className="button" onClick={close}>Готово</button>
          </div>
        ) : (
          <form onSubmit={submit} className={styles.form} aria-busy={status === "sending"}>
            <p className={styles.description}>{topic === "1c"
              ? "Расскажите, что нужно сделать в 1С. Если знаете конфигурацию и версию, укажите их в описании."
              : "Расскажите о вашей задаче и желаемом результате. Ответим на email и обсудим детали."}</p>
            <label htmlFor={`${id}-name`}>Ваше имя</label>
            <input id={`${id}-name`} name="name" autoComplete="name" required maxLength={100} disabled={status === "sending"} />
            <label htmlFor={`${id}-email`}>Email для ответа</label>
            <input id={`${id}-email`} name="email" type="email" autoComplete="email" required maxLength={254} disabled={status === "sending"} />
            <label htmlFor={`${id}-message`}>Что нужно сделать?</label>
            <textarea id={`${id}-message`} name="message" rows={5} required maxLength={5000} disabled={status === "sending"} />
            <div className={styles.honeypot} aria-hidden="true">
              <label htmlFor={`${id}-website`}>Оставьте это поле пустым</label>
              <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className="button" disabled={status === "sending"}>
              {status === "sending" ? "Отправляем…" : "Отправить"}
            </button>
          </form>
        )}
      </dialog>, document.body)}
    </>
  );
}
