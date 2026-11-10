import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.SHARE_URL;
assert(baseUrl, "Set SHARE_URL to the public demo URL");
const browser = await chromium.launch({ headless: true, channel: process.env.CHROME_CHANNEL || "chrome" });
const errors = [];
const failed = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${baseUrl}/welcome`, { waitUntil: "networkidle" });
  await page.getByTestId("welcome-email").fill(`share-${Date.now()}@example.com`);
  await page.getByTestId("welcome-password").fill("password123");
  await page.getByTestId("welcome-submit").click();
  await page.getByTestId("level-intermediate").waitFor({ timeout: 30000 });
  await page.getByTestId("level-intermediate").click();
  await page.locator("article[data-index='0'] video").waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video && !video.paused && video.muted;
  }, undefined, { timeout: 30000 });
  await page.getByText("+5 XP", { exact: true }).first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: "artifacts/share-demo-verified.png", fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log(JSON.stringify({ ok: true, publicRegistration: true, publicPlayback: true, completionXp: 5, consoleErrors: 0, failedRequests: 0 }));
} finally {
  await browser.close();
}
