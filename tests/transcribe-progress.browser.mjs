import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const base = process.env.TRANSCRIBE_TEST_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = (url, options) => {
      if (url !== "/api/transcribe") return original(url, options);
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          window.emitProgressTestEvent = (event) => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
          options.signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
        },
      }), { headers: { "Content-Type": "application/x-ndjson" } }));
    };
  });
  await page.goto(`${base}/transcribe`);
  await page.locator('input[type="file"]').setInputFiles({ name: "test.wav", mimeType: "audio/wav", buffer: Buffer.from("test") });
  await page.getByRole("button", { name: "Начать расшифровку" }).click();
  const bar = page.getByRole("progressbar");
  await expect(bar).toBeVisible();
  assert.equal(await bar.getAttribute("aria-valuenow"), null);
  const emit = (event) => page.evaluate(event => window.emitProgressTestEvent(event), event);
  await emit({ type: "stage", stage: "queued" });
  await expect(page.getByRole("status")).toHaveText("Ожидаем свободный слот");
  await emit({ type: "stage", stage: "transcribing" });
  await emit({ type: "progress", processed_seconds: 0, duration: 168 });
  await expect(bar).toHaveAttribute("aria-valuenow", "0");
  await emit({ type: "progress", processed_seconds: 70, duration: 168 });
  await expect(bar).toHaveAttribute("aria-valuenow", "41");
  await expect(page.getByText("Обработано 00:01:10 из 00:02:48 записи")).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await bar.scrollIntoViewIfNeeded();
    await expect.poll(() => bar.evaluate(element => Math.abs(
      element.firstElementChild.getBoundingClientRect().width / element.getBoundingClientRect().width - .41
    ))).toBeLessThan(.02);
    await page.screenshot({ path: `.test-artifacts/transcribe-progress-${width}.png` });
  }
  await emit({ type: "progress", processed_seconds: 60, duration: 168 });
  await expect(bar).toHaveAttribute("aria-valuenow", "41");
  await emit({ type: "progress", processed_seconds: 168, duration: 168 });
  await expect(bar).toHaveAttribute("aria-valuenow", "99");
  await emit({ type: "stage", stage: "formatting" });
  await expect(bar).toHaveAttribute("aria-valuenow", "100");
  await emit({ type: "error", error: "Тестовая ошибка" });
  await expect(bar).toHaveCount(0);
  await page.getByRole("button", { name: "Начать расшифровку" }).click();
  await expect(bar).toBeVisible();
  assert.equal(await bar.getAttribute("aria-valuenow"), null);
  await expect(page.getByText("Обработано 00:02:48 из 00:02:48 записи")).toHaveCount(0);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(bar).toHaveCount(0);
  console.log("Progress browser checks passed: stages, percentages, timestamps, mobile, completion, retry, cancellation.");
} finally {
  await browser.close();
}
