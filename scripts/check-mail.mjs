import nextEnv from "@next/env";
import nodemailer from "nodemailer";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const deadline = setTimeout(() => {
  console.log(JSON.stringify({ connected: false, code: "CHECK_TIMEOUT" }));
  process.exit(1);
}, 25000);
deadline.unref();
const user = process.env.GMAIL_USER?.trim();
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
if (!user || !pass) {
  console.log(JSON.stringify({ configured: false, userPresent: Boolean(user), passwordPresent: Boolean(pass) }));
  process.exitCode = 1;
} else {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user, pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, dnsTimeout: 10000,
  });
  try {
    await transport.verify();
    console.log(JSON.stringify({ connected: true, authenticated: true }));
  } catch (error) {
    // Only print diagnostic codes, never raw SMTP responses or credentials.
    console.log(JSON.stringify({
      connected: false,
      code: /^[A-Z0-9_]+$/.test(error.code ?? "") ? error.code : "UNKNOWN",
      responseCode: typeof error.responseCode === "number" ? error.responseCode : undefined,
      appPasswordRequired: /application.specific password|required.*app password/i.test(error.response ?? ""),
      credentialsRejected: /credentials.*not accepted|username and password not accepted/i.test(error.response ?? ""),
    }));
    process.exitCode = 1;
  } finally {
    transport.close();
  }
}
