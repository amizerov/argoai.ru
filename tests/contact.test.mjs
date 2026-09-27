import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import nodemailer from "nodemailer";
import { POST } from "../app/api/contact/route.ts";

const keys = ["GMAIL_USER", "GMAIL_APP_PASSWORD", "CONTACT_TO", "CONTACT_FORM_ORIGIN"];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
process.env.GMAIL_USER = "sender@example.com";
process.env.GMAIL_APP_PASSWORD = "test app password";
process.env.CONTACT_TO = "owner@example.com";
process.env.CONTACT_FORM_ORIGIN = "https://argoai.ru";

let mail;
let smtpOptions;
let smtpFailure = false;
let smtpAuthFailure = false;
let accepted = true;
let sends = 0;
const close = mock.fn();
mock.method(nodemailer, "createTransport", (options) => {
  smtpOptions = options;
  return {
    sendMail: async (message) => {
      sends += 1;
      mail = message;
      if (smtpAuthFailure) throw Object.assign(new Error("Private authentication diagnostic"), {
        code: "EAUTH", responseCode: 534, response: "534 5.7.9 Application-specific password required",
      });
      if (smtpFailure) throw new Error("Private SMTP diagnostic");
      return { accepted: accepted ? ["owner@example.com"] : [] };
    },
    close,
  };
});
mock.method(console, "error", () => {});

after(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
  mock.restoreAll();
});

const valid = { name: "Анна", email: "client@example.com", message: "Нужен отчёт по продажам", website: "" };
function request(fields = valid, headers = {}) {
  return new Request("https://argoai.ru/api/contact", {
    method: "POST",
    headers: { origin: "https://argoai.ru", "content-type": "application/json", ...headers },
    body: JSON.stringify(fields),
  });
}

test("rejects foreign origins and non-JSON requests without sending mail", async () => {
  assert.equal((await POST(request(valid, { origin: "https://other.example" }))).status, 403);
  assert.equal((await POST(request(valid, { "content-type": "text/plain" }))).status, 415);
  assert.equal(sends, 0);
});

test("rejects malformed JSON, honeypots, empty fields and header injection", async () => {
  const invalidJson = new Request("https://argoai.ru/api/contact", {
    method: "POST", headers: { origin: "https://argoai.ru", "content-type": "application/json" }, body: "{",
  });
  assert.equal((await POST(invalidJson)).status, 400);
  for (const fields of [null, [], { ...valid, website: "bot" }, { ...valid, name: "   " },
    { ...valid, name: "Name\r\nBcc: attacker@example.com" }, { ...valid, email: "bad" },
    { ...valid, email: "ok@example.com\r\nBcc: attacker@example.com" },
    { ...valid, message: "   " }, { ...valid, message: "x".repeat(5001) },
    { ...valid, topic: "unexpected" }]) {
    assert.equal((await POST(request(fields))).status, 400);
  }
  assert.equal(sends, 0);
});

test("bounds body size even without a Content-Length header", async () => {
  assert.equal((await POST(request({ ...valid, message: "x".repeat(25000) }))).status, 413);
  assert.equal(sends, 0);
});

test("missing password returns unavailable instead of reporting success", async () => {
  const password = process.env.GMAIL_APP_PASSWORD;
  delete process.env.GMAIL_APP_PASSWORD;
  try {
    assert.equal((await POST(request())).status, 503);
    assert.equal(sends, 0);
  } finally {
    process.env.GMAIL_APP_PASSWORD = password;
  }
});

test("sends from the configured Gmail account to the fixed inbox with client Reply-To", async () => {
  const response = await POST(request({ ...valid, name: " Анна ", to: "attacker@example.com", from: "attacker@example.com" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(smtpOptions.host, "smtp.gmail.com");
  assert.equal(smtpOptions.port, 465);
  assert.equal(smtpOptions.secure, true);
  assert.equal(smtpOptions.auth.pass, "testapppassword");
  assert.equal(mail.from.address, "sender@example.com");
  assert.equal(mail.to, "owner@example.com");
  assert.deepEqual(mail.replyTo, { name: "Анна", address: "client@example.com" });
  assert.match(mail.text, /Нужен отчёт по продажам/);
  assert.equal(mail.subject, "ARGO: заявка на обсуждение проекта");
  assert.match(mail.text, /Проект:/);
  assert.equal(close.mock.callCount(), 1);
});

test("SMTP failures and rejected recipients are not reported as success", async () => {
  smtpFailure = true;
  try {
    const response = await POST(request({ ...valid, email: "failure@example.com" }));
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /Private SMTP diagnostic|testapppassword/);
  } finally {
    smtpFailure = false;
  }
  accepted = false;
  try {
    assert.equal((await POST(request({ ...valid, email: "rejected@example.com" }))).status, 502);
  } finally {
    accepted = true;
  }
  assert.equal(close.mock.callCount(), 3);
});

test("blocks a fourth submission from the same email, ignoring case", async () => {
  for (let count = 0; count < 3; count++) {
    assert.equal((await POST(request({ ...valid, email: "limited@example.com" }))).status, 200);
  }
  const before = sends;
  const response = await POST(request({ ...valid, email: "LIMITED@example.com" }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "600");
  assert.equal(sends, before);
});

test("the 1C form preserves its specific email subject and task label", async () => {
  const response = await POST(request({ ...valid, email: "one-c@example.com", topic: "1c" }));
  assert.equal(response.status, 200);
  assert.equal(mail.subject, "ARGO: новая задача по 1С");
  assert.match(mail.text, /Задача по 1С:/);
});

test("accepts local form requests with a full localhost URL and normalizes config whitespace and slash", async () => {
  const original = process.env.CONTACT_FORM_ORIGIN;
  process.env.CONTACT_FORM_ORIGIN = " http://localhost:3000/ ";
  try {
    const response = await POST(new Request("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ ...valid, email: "local@example.com" }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(mail.replyTo.address, "local@example.com");
    assert.equal((await POST(request())).status, 403);
  } finally {
    process.env.CONTACT_FORM_ORIGIN = original;
  }
});

test("uses the request origin for blank local config and rejects missing or foreign origins", async () => {
  const original = process.env.CONTACT_FORM_ORIGIN;
  process.env.CONTACT_FORM_ORIGIN = "   ";
  try {
    const localRequest = (origin) => new Request("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { ...(origin ? { origin } : {}), "content-type": "application/json" },
      body: JSON.stringify({ ...valid, email: "local-default@example.com" }),
    });
    assert.equal((await POST(localRequest("http://localhost:3000"))).status, 200);
    const before = sends;
    for (const origin of [undefined, "null", "http://localhost:3001", "https://other.example"]) {
      assert.equal((await POST(localRequest(origin))).status, 403);
    }
    assert.equal(sends, before);
  } finally {
    process.env.CONTACT_FORM_ORIGIN = original;
  }
});

test("reports invalid server configuration without blaming the form or sending mail", async () => {
  const original = process.env.CONTACT_FORM_ORIGIN;
  const before = sends;
  try {
    for (const origin of ["localhost:3000", "not a URL", "ftp://argoai.ru"]) {
      process.env.CONTACT_FORM_ORIGIN = origin;
      assert.equal((await POST(request())).status, 503);
    }
    assert.equal(sends, before);
  } finally {
    process.env.CONTACT_FORM_ORIGIN = original;
  }
});

test("explains Gmail app password errors locally without exposing details in production", async () => {
  const originalMode = process.env.NODE_ENV;
  smtpAuthFailure = true;
  try {
    process.env.NODE_ENV = "development";
    const development = await POST(request({ ...valid, email: "auth-dev@example.com" }));
    assert.equal(development.status, 502);
    assert.match((await development.json()).error, /Gmail требует пароль приложения/);
    process.env.NODE_ENV = "production";
    const production = await POST(request({ ...valid, email: "auth-prod@example.com" }));
    assert.equal(production.status, 502);
    assert.doesNotMatch(await production.text(), /GMAIL_APP_PASSWORD|Private authentication|534/);
  } finally {
    smtpAuthFailure = false;
    if (originalMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalMode;
  }
});
