import nodemailer from "nodemailer";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 24_000;
const WINDOW_MS = 10 * 60 * 1000;
// A bounded, per-process limit. Multi-instance deployments need a shared limiter.
const attempts: { email: string; time: number }[] = [];
const emailPattern = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;

function failure(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  let expectedOrigin: string;
  try {
    const configuredOrigin = process.env.CONTACT_FORM_ORIGIN?.trim();
    const siteUrl = new URL(configuredOrigin || request.url);
    if (!["http:", "https:"].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) {
      throw new Error("Invalid contact form origin");
    }
    expectedOrigin = siteUrl.origin;
  } catch {
    console.error("Contact form: CONTACT_FORM_ORIGIN must be an http:// or https:// URL.");
    return failure("Отправка временно недоступна. Напишите на hello@argoai.ru.", 503);
  }
  if (request.headers.get("origin") !== expectedOrigin) {
    return failure("Не удалось проверить адрес сайта. Обновите страницу и повторите отправку.", 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return failure("Неверный формат заявки.", 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return failure("Заявка слишком длинная.", 413);
  }

  let data: unknown;
  const reader = request.body?.getReader();
  if (!reader) return failure("Заполните поля заявки.", 400);
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return failure("Заявка слишком длинная.", 413);
      }
      chunks.push(value);
    }
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return failure("Неверный формат заявки.", 400);
  } finally {
    reader.releaseLock();
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return failure("Заполните поля заявки.", 400);
  }
  const fields = data as Record<string, unknown>;
  if (fields.website) return failure("Не удалось отправить заявку.", 400);
  const topic = fields.topic ?? "project";
  if (topic !== "project" && topic !== "1c") return failure("Неверная тема заявки.", 400);
  const taskLabel = topic === "1c" ? "Задача по 1С" : "Проект";
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  const email = typeof fields.email === "string" ? fields.email.trim() : "";
  const message = typeof fields.message === "string" ? fields.message.trim() : "";
  if (!name || name.length > 100 || /[\r\n]/.test(name)) {
    return failure("Укажите ваше имя (до 100 символов).", 400);
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    return failure("Укажите корректный email для ответа.", 400);
  }
  if (!message || message.length > 5000) {
    return failure("Опишите задачу (до 5000 символов).", 400);
  }

  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  const recipient = process.env.CONTACT_TO?.trim() || user;
  if (!user || !emailPattern.test(user) || !password || !recipient || !emailPattern.test(recipient)) {
    return failure("Отправка временно недоступна. Напишите на hello@argoai.ru.", 503);
  }

  const now = Date.now();
  while (attempts.length && attempts[0].time <= now - WINDOW_MS) attempts.shift();
  const emailKey = email.toLowerCase();
  if (attempts.length >= 30 || attempts.filter((entry) => entry.email === emailKey).length >= 3) {
    return Response.json({ error: "Слишком много заявок. Попробуйте через 10 минут." }, {
      status: 429, headers: { "Retry-After": "600" },
    });
  }
  attempts.push({ email: emailKey, time: now });

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    dnsTimeout: 10_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from: { name: "ARGO — заявки с сайта", address: user },
      to: recipient,
      replyTo: { name, address: email },
      subject: topic === "1c" ? "ARGO: новая задача по 1С" : "ARGO: заявка на обсуждение проекта",
      text: `Заявка с сайта ARGO\n\nИмя: ${name}\nEmail: ${email}\n\n${taskLabel}:\n${message}`,
    });
    if (!result.accepted.length) throw new Error("SMTP recipient rejected");
    return Response.json({ ok: true });
  } catch (error) {
    const smtpError = error as { code?: unknown; responseCode?: unknown; response?: unknown } | null;
    const code = typeof smtpError?.code === "string" && /^[A-Z0-9_]+$/.test(smtpError.code)
      ? smtpError.code : "UNKNOWN";
    const responseCode = typeof smtpError?.responseCode === "number" ? smtpError.responseCode : undefined;
    const appPasswordRequired = code === "EAUTH" && responseCode === 534
      && typeof smtpError?.response === "string"
      && /application.specific password/i.test(smtpError.response);
    // Log only safe diagnostic codes, never credentials, customer data or SMTP responses.
    console.error("Contact form: email delivery failed.", { code, responseCode, appPasswordRequired });
    if (process.env.NODE_ENV === "development" && code === "EAUTH") {
      return failure(appPasswordRequired
        ? "Gmail требует пароль приложения. Укажите его в GMAIL_APP_PASSWORD в .env.local и перезапустите сервер."
        : "Gmail отклонил авторизацию. Проверьте GMAIL_USER и пароль приложения GMAIL_APP_PASSWORD в .env.local.", 502);
    }
    return failure("Не удалось отправить заявку. Попробуйте позже или напишите на hello@argoai.ru.", 502);
  } finally {
    transport.close();
  }
}
