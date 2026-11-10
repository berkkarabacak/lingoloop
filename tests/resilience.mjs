import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const server = spawn(process.execPath, ["scripts/dev.mjs"], { env: { ...process.env, API_PORT: "4100", WEB_PORT: "7101", EXPO_PUBLIC_API_URL: "http://127.0.0.1:4100" }, stdio: "ignore" });
let browser;
try {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch("http://127.0.0.1:7101/")).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  browser = await chromium.launch({ headless: true, channel: process.env.CHROME_CHANNEL || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route("**/api/feed?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });
  await page.route("**/media/clips/*.mp4", (route) => route.abort());
  await page.goto("http://127.0.0.1:7101/welcome", { waitUntil: "domcontentloaded" });
  await page.getByTestId("welcome-email").fill(`slow-${Date.now()}@example.com`);
  await page.getByTestId("welcome-password").fill("password123");
  await page.getByTestId("welcome-submit").click();
  await page.getByTestId("level-intermediate").click();
  await page.getByText("Preparing your first words…", { exact: true }).waitFor();
  console.log("[resilience] Slow-loading skeleton visible");
  await page.getByText("Video unavailable", { exact: true }).first().waitFor({ timeout: 25000 });
  await page.getByText("To understand or solve something after thinking about it.", { exact: true }).waitFor();
  await page.getByText("+5 XP", { exact: true }).first().waitFor({ timeout: 12000 });
  console.log("[resilience] Video failure preserves lesson and fallback XP");
  assert(true);
} finally {
  if (browser) await browser.close();
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}
