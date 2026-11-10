import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { createApp, upsertContent } from "../src/app.ts";
import { localDate, openDatabase } from "../src/db.ts";

async function setup() {
  const db = openDatabase(":memory:");
  const mediaDir = path.resolve("./media");
  const items = JSON.parse(fs.readFileSync(path.resolve("../content/seed.json"), "utf8"));
  for (const item of items) upsertContent(db, item, mediaDir);
  const app = createApp({ db, mediaDir });
  const signup = await app.request("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "learner@example.com", password: "password123", timezone: "Europe/Istanbul" }) });
  assert.equal(signup.status, 201);
  const { token } = await signup.json();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  await app.request("/api/me", { method: "PATCH", headers: auth, body: JSON.stringify({ level: "intermediate" }) });
  return { db, app, token, auth };
}

test("health, registration, level, and feed work", async () => {
  const { app, auth } = await setup();
  assert.equal((await app.request("/api/health")).status, 200);
  const response = await app.request("/api/feed", { headers: auth });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items.length, 8);
  assert.equal(body.items[0].headword, "figure out");
  assert.equal(body.nextCursor, null);
});

test("completion XP is idempotent and saved words persist", async () => {
  const { app, auth } = await setup();
  const feed = await (await app.request("/api/feed", { headers: auth })).json();
  const item = feed.items[0];
  const payload = JSON.stringify({ videoId: item.videoId, event: "complete" });
  const first = await (await app.request("/api/progress/view", { method: "POST", headers: auth, body: payload })).json();
  const second = await (await app.request("/api/progress/view", { method: "POST", headers: auth, body: payload })).json();
  assert.equal(first.xpAwarded, 5);
  assert.equal(second.xpAwarded, 0);
  assert.equal(second.stats.wordsLearned, 1);
  assert.equal(second.stats.streakCurrent, 1);
  assert.equal((await app.request(`/api/saved/${item.vocabId}`, { method: "PUT", headers: auth })).status, 204);
  assert.equal((await app.request(`/api/saved/${item.vocabId}`, { method: "PUT", headers: auth })).status, 204);
  const saved = await (await app.request("/api/saved", { headers: auth })).json();
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].headword, "figure out");
});

test("quiz unlocks after four completed words and grades answers", async () => {
  const { app, auth } = await setup();
  const feed = await (await app.request("/api/feed", { headers: auth })).json();
  for (const item of feed.items.slice(0, 4)) await app.request("/api/progress/view", { method: "POST", headers: auth, body: JSON.stringify({ videoId: item.videoId, event: "complete" }) });
  const created = await app.request("/api/quizzes", { method: "POST", headers: auth });
  assert.equal(created.status, 201);
  const quiz = await created.json();
  assert.equal(quiz.questions.length, 4);
  assert.equal(quiz.questions[0].options.length, 4);
  assert(!("correctOptionId" in quiz.questions[0]));
  for (const question of quiz.questions) {
    const response = await app.request(`/api/quizzes/${quiz.id}/answers`, { method: "POST", headers: auth, body: JSON.stringify({ index: question.index, optionId: "a" }) });
    assert.equal(response.status, 200);
  }
  const completed = await (await app.request(`/api/quizzes/${quiz.id}/complete`, { method: "POST", headers: auth })).json();
  assert.equal(completed.total, 4);
  assert.equal(completed.xpAwarded, 20);
  const again = await (await app.request(`/api/quizzes/${quiz.id}/complete`, { method: "POST", headers: auth })).json();
  assert.equal(again.xpAwarded, 0);
});

test("quiz is locked before four words and admin is forbidden to learners", async () => {
  const { app, auth } = await setup();
  const quiz = await app.request("/api/quizzes", { method: "POST", headers: auth });
  assert.equal(quiz.status, 409);
  const admin = await app.request("/api/admin/content", { headers: auth });
  assert.equal(admin.status, 403);
});

test("media supports range requests and blocks traversal", async () => {
  const { app } = await setup();
  const response = await app.request("/media/clips/give-up.mp4", { headers: { Range: "bytes=0-99" } });
  assert.equal(response.status, 206);
  assert.match(response.headers.get("content-range") || "", /^bytes 0-99\//);
  assert.equal((await app.request("/media/../data/lingoloop.db")).status, 404);
});

test("feed keyset remains stable when earlier items become seen", async () => {
  const { app, auth } = await setup();
  const first = await (await app.request("/api/feed?limit=3", { headers: auth })).json();
  assert.equal(first.items.length, 3);
  assert(first.nextCursor);
  for (const item of first.items) await app.request("/api/progress/view", { method: "POST", headers: auth, body: JSON.stringify({ videoId: item.videoId, event: "start" }) });
  const second = await (await app.request(`/api/feed?limit=3&cursor=${encodeURIComponent(first.nextCursor)}`, { headers: auth })).json();
  assert.equal(second.items.length, 3);
  assert.equal(second.items[0].headword, "catch up");
  assert.deepEqual(second.items.map((item: any) => item.videoId).filter((videoId: string) => first.items.some((item: any) => item.videoId === videoId)), []);
});

test("timezone boundaries and streak gaps are handled", async () => {
  assert.equal(localDate("Pacific/Auckland", new Date("2026-11-03T23:30:00Z")), "2026-11-04");
  const { app, db, auth } = await setup();
  const user = db.prepare("SELECT * FROM users WHERE email='learner@example.com'").get() as any;
  const today = localDate(user.timezone);
  const dates = [0, -1, -2].map((offset) => localDate(user.timezone, new Date(Date.now() + offset * 86400000)));
  dates.forEach((date, index) => db.prepare("INSERT INTO xp_events (id,user_id,kind,ref_id,amount,local_date,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(`streak-${index}`, user.id, "view_complete", `streak-${index}`, 5, date, new Date().toISOString()));
  let me = await (await app.request("/api/me", { headers: auth })).json();
  assert.equal(me.stats.streakCurrent, 3);
  db.prepare("DELETE FROM xp_events WHERE ref_id='streak-1'").run();
  me = await (await app.request("/api/me", { headers: auth })).json();
  assert.equal(me.stats.streakCurrent, 1);
});

test("admin dry-run reports validation without writing content", async () => {
  const { app, db, auth } = await setup();
  db.prepare("UPDATE users SET role='admin' WHERE email='learner@example.com'").run();
  const items = JSON.parse(fs.readFileSync(path.resolve("../content/seed.json"), "utf8"));
  const invalid = { ...items[0], slug: "invalid-cues", video: { ...items[0].video, subtitles: [] } };
  const response = await app.request("/api/admin/import?dryRun=1", { method: "POST", headers: auth, body: JSON.stringify([items[0], invalid]) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].slug, "invalid-cues");
  assert.equal((db.prepare("SELECT COUNT(*) n FROM vocab_items").get() as any).n, 24);
});
