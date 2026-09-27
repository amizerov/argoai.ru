import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.env.TRANSCRIBE_TEST_URL || "http://localhost:3001";
await mkdir(".test-artifacts", { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function noOverflow() {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Horizontal overflow");
}
try {
  for (const width of [1920, 1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(`${base}/transcribe`);
    await page.getByRole("heading", { name: "Расшифровка аудио и видео онлайн", exact: true }).waitFor();
    await noOverflow();
    if (width > 820) {
      const brand = await page.locator(".site-header .brand").boundingBox();
      const nav = await page.locator(".desktop-nav").boundingBox();
      assert.ok(nav.x >= brand.x + brand.width, `Header overlap at ${width}`);
    }
    await page.screenshot({ path: `.test-artifacts/transcribe-${width}.png`, fullPage: true });
  }
  // Check direct upload validation before invoking the real CPU model.
  await page.locator('input[type="file"]').setInputFiles({ name: "invalid.exe", mimeType: "application/octet-stream", buffer: Buffer.from("invalid") });
  await page.getByRole("alert").filter({ hasText: "Формат не поддерживается" }).waitFor();
  await page.locator('input[type="file"]').setInputFiles(".test-artifacts/speech-ru.wav");
  await page.getByLabel("Язык записи").selectOption("ru");
  await page.getByRole("button", { name: "Начать расшифровку" }).click();
  await page.getByRole("heading", { name: "Расшифровка готова" }).waitFor({ timeout: 120000 });
  await noOverflow();
  const timestampButtons = page.getByRole("button", { name: /^Перейти к/ });
  assert.ok(await timestampButtons.count() > 0);
  if (await timestampButtons.count() > 1) {
    await timestampButtons.nth(1).click();
    assert.ok(await page.locator("audio").evaluate((audio) => audio.currentTime) > 0);
    await page.locator("audio").evaluate((audio) => audio.pause());
  }
  await page.screenshot({ path: ".test-artifacts/transcribe-result-390.png", fullPage: true });
  await page.getByRole("tab", { name: "Текст", exact: true }).click();
  await page.getByRole("button", { name: "Скопировать", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Скопировано" }).waitFor();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clipboard, /[А-Яа-я]{3}/);
  for (const extension of ["TXT", "SRT", "VTT"]) {
    if (extension !== "TXT") await page.getByRole("tab", { name: "Субтитры" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: `Скачать ${extension}` }).click();
    const download = await downloadPromise;
    const text = await readFile(await download.path(), "utf8");
    assert.match(download.suggestedFilename(), new RegExp(`\\.${extension.toLowerCase()}$`));
    if (extension === "TXT") assert.match(text, /Язык: ru/);
    if (extension === "SRT") assert.match(text, /00:00:\d\d,\d{3} -->/);
    if (extension === "VTT") assert.match(text, /^WEBVTT\n/);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("tab", { name: "Расшифровка", exact: true }).click();
  await noOverflow();
  await page.screenshot({ path: ".test-artifacts/transcribe-result-1440.png", fullPage: true });
  await page.goto(base);
  await page.getByRole("link", { name: "Попробовать бесплатно" }).click();
  await page.waitForURL("**/transcribe");
  assert.deepEqual(errors, []);
  console.log("Browser checks passed: 5 viewport sizes, real WAV transcription, seek, copy, TXT/SRT/VTT, home link.");
} finally {
  await browser.close();
}
