import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = spawn(process.execPath, ["scripts/dev.mjs"], { cwd: root, env: { ...process.env, API_PORT: "4100", WEB_PORT: "7101", EXPO_PUBLIC_API_URL: "http://127.0.0.1:4100" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });
fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
let browser;
const errors = [];
const failed = [];

async function waitReady() {
  for (let attempt = 0; attempt < 160; attempt++) {
    try {
      const [api, web] = await Promise.all([fetch("http://127.0.0.1:4100/api/health"), fetch("http://127.0.0.1:7101/")]);
      if (api.ok && web.ok) return;
    } catch { /* Development processes are starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`LingoLoop did not start.\n${output}`);
}
function watch(page) {
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
}

try {
  await waitReady();
  browser = await chromium.launch({ headless: true, channel: process.env.CHROME_CHANNEL || undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  watch(page);
  await page.goto("http://127.0.0.1:7101/", { waitUntil: "networkidle" });
  const email = `e2e-${Date.now()}@example.com`;
  await page.getByTestId("welcome-email").fill(email);
  await page.getByTestId("welcome-password").fill("password123");
  await page.getByTestId("welcome-submit").click();
  await page.getByTestId("level-intermediate").waitFor({ timeout: 30000 });
  await page.getByTestId("level-intermediate").click();
  await page.getByText("figure out", { exact: true }).first().waitFor({ timeout: 30000 });
  console.log("[e2e] Registration and level selection passed");

  const video = page.locator("video").first();
  await video.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => {
    const element = document.querySelector("video");
    return element && !element.paused && element.muted;
  }, undefined, { timeout: 20000 });
  await page.getByText("+5 XP", { exact: true }).first().waitFor({ timeout: 25000 });
  console.log("[e2e] Autoplay and completion XP passed");

  await page.locator("[role=feed]").focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => {
    const second = document.querySelector('article[data-index="1"] video');
    return second && !second.paused;
  });
  await page.locator('article[data-index="1"] [data-testid="rail-save"]').click();
  await page.getByText("Saved", { exact: true }).last().click();
  await page.getByText("give up", { exact: true }).first().waitFor();
  await page.getByTestId("saved-unsave-give-up").click();
  await page.getByText("Nothing saved yet", { exact: true }).waitFor();
  console.log("[e2e] Pager, save, collection, and unsave passed");

  const token = await page.evaluate(() => localStorage.getItem("lingoloop.token"));
  const feed = await (await fetch("http://127.0.0.1:4100/api/feed", { headers: { Authorization: `Bearer ${token}` } })).json();
  for (const item of feed.items.slice(0, 4)) {
    await fetch("http://127.0.0.1:4100/api/progress/view", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ videoId: item.videoId, event: "complete" }) });
  }
  await page.getByText("Quiz", { exact: true }).last().click();
  await page.locator('[data-testid^="quiz-option-"]').first().waitFor({ timeout: 20000 });
  const questionHeading = await page.getByText(/Question 1 of \d+/).innerText();
  const total = Number(questionHeading.split(" of ")[1]);
  for (let index = 0; index < total; index++) {
    await page.locator('[data-testid^="quiz-option-"]').first().click();
    const next = page.getByText(index === total - 1 ? "See results" : "Next", { exact: true });
    await next.waitFor({ timeout: 10000 });
    await next.click();
  }
  await page.getByTestId("quiz-result-score").waitFor();
  assert.match(await page.getByTestId("quiz-result-score").innerText(), new RegExp(`^\\d+\\/${total}$`));
  console.log("[e2e] Complete quiz and scoring passed");

  await page.getByText("Profile", { exact: true }).last().click();
  await page.getByText("Total XP", { exact: true }).waitFor();
  await page.getByText("1 quizzes completed", { exact: true }).waitFor();
  const persistedXp = await page.getByTestId("profile-xp").innerText();
  await page.screenshot({ path: "test-results/lingoloop-profile-mobile.png", fullPage: true });
  await page.goto("http://127.0.0.1:7101/", { waitUntil: "networkidle" });
  await page.locator("article[data-index='0'] video").waitFor({ state: "visible", timeout: 20000 });
  await page.screenshot({ path: "test-results/lingoloop-feed-mobile.png", fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/lingoloop-feed-desktop.png", fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `Desktop overflow: ${overflow}`);
  console.log("[e2e] Mobile and desktop layouts captured");

  const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const secondPage = await secondContext.newPage();
  watch(secondPage);
  await secondPage.goto("http://127.0.0.1:7101/welcome", { waitUntil: "networkidle" });
  await secondPage.getByText("Sign in", { exact: true }).click();
  await secondPage.getByTestId("welcome-email").fill(email);
  await secondPage.getByTestId("welcome-password").fill("password123");
  await secondPage.getByTestId("welcome-submit").click();
  await secondPage.locator("article[data-index='0']").waitFor({ timeout: 20000 });
  await secondPage.getByText("Profile", { exact: true }).last().click();
  await secondPage.getByTestId("profile-xp").waitFor({ timeout: 20000 });
  assert.equal(await secondPage.getByTestId("profile-xp").innerText(), persistedXp);
  console.log("[e2e] Second-browser progress persistence passed");
  await secondContext.close();

  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await admin.newPage();
  watch(adminPage);
  await adminPage.goto("http://127.0.0.1:7101/welcome", { waitUntil: "networkidle" });
  await adminPage.getByText("Sign in", { exact: true }).click();
  await adminPage.getByTestId("welcome-email").fill("admin@lingoloop.local");
  await adminPage.getByTestId("welcome-password").fill("admin123");
  await adminPage.getByTestId("welcome-submit").click();
  await adminPage.getByTestId("level-intermediate").waitFor({ timeout: 20000 }).catch(() => {});
  await adminPage.goto("http://127.0.0.1:7101/admin", { waitUntil: "networkidle" });
  await adminPage.getByText("Content studio", { exact: true }).waitFor({ timeout: 20000 });
  await adminPage.getByRole("button", { name: "New item" }).click();
  const editor = adminPage.getByLabel("Content JSON editor");
  const item = JSON.parse(await editor.inputValue());
  Object.assign(item, { slug: `e2e-${Date.now()}`, headword: "test expression", forms: ["test expression"], example: "This test expression is ready for class.", status: "published" });
  item.video.url = "/media/clips/give-up.mp4";
  item.video.poster = "/media/posters/give-up.jpg";
  item.video.subtitles = [{ startMs: 500, endMs: 7500, text: "This test expression is ready for class." }];
  await editor.fill(JSON.stringify(item, null, 2));
  await adminPage.getByRole("button", { name: "Save content item" }).click();
  await adminPage.getByText("Content saved and ready to publish.", { exact: true }).waitFor();
  const statusButton = adminPage.getByTestId(`admin-status-${item.slug}`);
  await statusButton.waitFor();
  await statusButton.click();
  console.log("[e2e] Administrator create and unpublish passed");

  assert.deepEqual(errors, [], `Browser errors:\n${errors.join("\n")}`);
  assert.deepEqual(failed, [], `Failed requests:\n${failed.join("\n")}`);
  console.log(JSON.stringify({ ok: true, consoleErrors: 0, failedRequests: 0, mobileOverflow: 0 }, null, 2));
  await admin.close();
  await context.close();
} catch (error) {
  console.error(error.stack || error);
  console.error(JSON.stringify({ browserErrors: errors, failedRequests: failed }, null, 2));
  const firstPage = browser?.contexts().flatMap((context) => context.pages())[0];
  if (firstPage) await firstPage.screenshot({ path: "test-results/chrome-failure.png", fullPage: true });
  if (output) console.error(output.slice(-12000));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
}
