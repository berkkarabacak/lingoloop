import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "artifacts", "ui-review");
fs.mkdirSync(output, { recursive: true });
const apiUrl = "http://127.0.0.1:4100";
const webUrl = "http://127.0.0.1:7101";
const server = spawn(process.execPath, ["scripts/dev.mjs"], {
  cwd: root,
  env: { ...process.env, API_PORT: "4100", WEB_PORT: "7101", EXPO_PUBLIC_API_URL: apiUrl },
  stdio: "ignore",
});
let browser;
const manifest = [];

async function capture(page, name, title) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  manifest.push({ name, title, file: `${name}.png`, width: page.viewportSize().width, height: page.viewportSize().height });
}

try {
  for (let attempt = 0; attempt < 160; attempt++) {
    try {
      const [api, web] = await Promise.all([fetch(`${apiUrl}/api/health`), fetch(webUrl)]);
      if (api.ok && web.ok) break;
    } catch { /* Servers are starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true, channel: process.env.CHROME_CHANNEL || "chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`${webUrl}/welcome`, { waitUntil: "networkidle" });
  await page.getByTestId("welcome-email").waitFor({ state: "visible", timeout: 30000 });
  await capture(page, "01-welcome", "Welcome and account creation");
  await page.getByTestId("welcome-email").fill(`review-${Date.now()}@example.com`);
  await page.getByTestId("welcome-password").fill("password123");
  await page.getByTestId("welcome-submit").click();
  await page.getByTestId("level-intermediate").waitFor({ timeout: 30000 });
  await capture(page, "02-level-selection", "Learning level selection");
  await page.getByTestId("level-intermediate").click();
  await page.locator("article[data-index='0'] video").waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video && !video.paused && video.muted;
  }, undefined, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await capture(page, "03-learning-feed", "Video learning feed");

  await page.getByText("Saved", { exact: true }).last().click();
  await page.getByText("Nothing saved yet", { exact: true }).waitFor();
  await capture(page, "04-saved-empty", "Saved words empty state");
  await page.getByText("Learn", { exact: true }).last().click();
  await page.locator("[data-testid='rail-save']").first().click();
  await page.getByText("Saved", { exact: true }).last().click();
  await page.locator("[data-testid^='saved-unsave-']").first().waitFor();
  await capture(page, "05-saved-word", "Saved word collection");

  const token = await page.evaluate(() => localStorage.getItem("lingoloop.token"));
  const feed = await (await fetch(`${apiUrl}/api/feed`, { headers: { Authorization: `Bearer ${token}` } })).json();
  for (const item of feed.items.slice(0, 4)) {
    await fetch(`${apiUrl}/api/progress/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: item.videoId, event: "complete" }),
    });
  }
  await page.getByText("Quiz", { exact: true }).last().click();
  await page.locator("[data-testid^='quiz-option-']").first().waitFor({ timeout: 30000 });
  await capture(page, "06-quiz-question", "Vocabulary quiz question");
  const heading = await page.getByText(/Question 1 of \d+/).innerText();
  const total = Number(heading.split(" of ")[1]);
  for (let index = 0; index < total; index++) {
    await page.locator("[data-testid^='quiz-option-']").first().click();
    const next = page.getByText(index === total - 1 ? "See results" : "Next", { exact: true });
    await next.waitFor({ timeout: 10000 });
    await next.click();
  }
  await page.getByTestId("quiz-result-score").waitFor();
  await capture(page, "07-quiz-result", "Quiz completion and score");
  await page.getByText("Profile", { exact: true }).last().click();
  await page.getByTestId("profile-xp").waitFor();
  await capture(page, "08-learner-profile", "Learner progress and level");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(webUrl, { waitUntil: "networkidle" });
  await page.locator("article[data-index='0'] video").waitFor({ timeout: 30000 });
  await capture(page, "09-feed-desktop", "Desktop learning feed");

  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await admin.newPage();
  await adminPage.goto(`${webUrl}/welcome`, { waitUntil: "networkidle" });
  await adminPage.getByText("Sign in", { exact: true }).click();
  await adminPage.getByTestId("welcome-email").fill("admin@lingoloop.local");
  await adminPage.getByTestId("welcome-password").fill("admin123");
  await adminPage.getByTestId("welcome-submit").click();
  await adminPage.getByTestId("level-intermediate").waitFor({ timeout: 20000 }).catch(() => {});
  await adminPage.goto(`${webUrl}/admin`, { waitUntil: "networkidle" });
  await adminPage.getByText("Content studio", { exact: true }).waitFor({ timeout: 30000 });
  await capture(adminPage, "10-admin-studio", "Administrator content studio");
  await admin.close();
  await context.close();
  fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify({ app: "LingoLoop", capturedAt: new Date().toISOString(), screens: manifest }, null, 2));
  console.log(JSON.stringify({ ok: true, screens: manifest.length, output }, null, 2));
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}
