import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ContentItemInput, Cue, Level } from "@lingoloop/shared";
import { LEVELS, QUIZ_MIN_WORDS, QUIZ_SIZE, XP_QUIZ_COMPLETE, XP_QUIZ_CORRECT, XP_VIEW } from "@lingoloop/shared";
import { createSession, hashPassword, id, json, localDate, now, openDatabase, publicUser, userForToken, verifyPassword, type DB } from "./db.ts";

const fail = (c: any, status: number, code: string, message: string, extra: any = {}) => c.json({ error: { code, message, ...extra } }, status);
const shuffle = <T>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const tokenFrom = (c: any) => c.req.header("authorization")?.replace(/^Bearer\s+/i, "");

function award(db: DB, user: any, kind: string, refId: string, amount: number): number {
  const result = db.prepare("INSERT OR IGNORE INTO xp_events (id,user_id,kind,ref_id,amount,local_date,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(id(), user.id, kind, refId, amount, localDate(user.timezone), now());
  return result.changes ? amount : 0;
}

function getStats(db: DB, user: any) {
  const timezone = user.timezone || "UTC";
  const today = localDate(timezone);
  const xpTotal = (db.prepare("SELECT COALESCE(SUM(amount),0) n FROM xp_events WHERE user_id=?").get(user.id) as any).n;
  const xpToday = (db.prepare("SELECT COALESCE(SUM(amount),0) n FROM xp_events WHERE user_id=? AND local_date=?").get(user.id, today) as any).n;
  const wordsLearned = (db.prepare("SELECT COUNT(DISTINCT vocab_id) n FROM video_views v JOIN videos x ON x.id=v.video_id WHERE v.user_id=? AND completed_at IS NOT NULL").get(user.id) as any).n;
  const wordsSaved = (db.prepare("SELECT COUNT(*) n FROM saved_words WHERE user_id=?").get(user.id) as any).n;
  const quizzesCompleted = (db.prepare("SELECT COUNT(*) n FROM quiz_attempts WHERE user_id=? AND completed_at IS NOT NULL").get(user.id) as any).n;
  const accuracy = db.prepare("SELECT answers FROM quiz_attempts WHERE user_id=? AND completed_at IS NOT NULL").all(user.id) as any[];
  let correct = 0, answered = 0;
  for (const attempt of accuracy) for (const answer of Object.values(json(attempt.answers, {}) as any) as any[]) { answered++; if (answer.correct) correct++; }
  const dates = (db.prepare("SELECT DISTINCT local_date d FROM xp_events WHERE user_id=? ORDER BY d DESC").all(user.id) as any[]).map((row) => row.d);
  const dateShift = (days: number) => localDate(timezone, new Date(Date.now() + days * 86400000));
  let streakCurrent = 0;
  let cursor = dates.includes(today) ? today : dateShift(-1);
  while (dates.includes(cursor)) {
    streakCurrent++;
    const previous = new Date(`${cursor}T12:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1);
    cursor = previous.toISOString().slice(0, 10);
  }
  let streakBest = streakCurrent;
  for (let index = 0; index < dates.length;) {
    let count = 1;
    while (index + count < dates.length) {
      const expected = new Date(`${dates[index + count - 1]}T12:00:00Z`); expected.setUTCDate(expected.getUTCDate() - 1);
      if (dates[index + count] !== expected.toISOString().slice(0, 10)) break;
      count++;
    }
    streakBest = Math.max(streakBest, count);
    index += count;
  }
  const last7Days = Array.from({ length: 7 }, (_, offset) => {
    const date = dateShift(offset - 6);
    return { date, xp: (db.prepare("SELECT COALESCE(SUM(amount),0) n FROM xp_events WHERE user_id=? AND local_date=?").get(user.id, date) as any).n };
  });
  return { xpTotal, xpToday, streakCurrent, streakBest, wordsLearned, wordsSaved, quizzesCompleted, quizAccuracy: answered ? Math.round(correct / answered * 100) : 0, last7Days };
}

function feedRow(db: DB, user: any, row: any, isReview = false) {
  return {
    videoId: row.video_id, vocabId: row.vocab_id, slug: row.slug, headword: row.headword,
    forms: json(row.forms, []), partOfSpeech: row.part_of_speech, ipa: row.ipa,
    definition: row.definition, example: row.example_sentence, level: row.level,
    videoUrl: row.video_url, posterUrl: row.poster_url, durationMs: row.duration_ms,
    subtitles: json(row.subtitles, []), sourceType: row.source_type, license: row.license,
    attribution: row.attribution,
    saved: Boolean(db.prepare("SELECT 1 FROM saved_words WHERE user_id=? AND vocab_id=?").get(user.id, row.vocab_id)),
    seen: Boolean(row.last_viewed_at), isReview,
  };
}

const contentSelect = `SELECT v.id video_id,v.slug,v.video_url,v.poster_url,v.duration_ms,v.subtitles,v.source_type,v.license,v.attribution,v.source_url,v.status,v.sort_order,
  x.id vocab_id,x.headword,x.forms,x.part_of_speech,x.ipa,x.definition,x.example_sentence,x.level,x.translations,
  w.last_viewed_at,w.completed_at,w.first_viewed_at FROM videos v JOIN vocab_items x ON x.id=v.vocab_id`;

function contentIssues(item: ContentItemInput, mediaDir: string): string[] {
  const issues: string[] = [];
  if (!/^[a-z0-9-]{2,60}$/.test(item.slug)) issues.push("Slug must use 2–60 lowercase letters, numbers, or hyphens.");
  if (!item.headword || !item.definition || !item.example || !item.partOfSpeech) issues.push("Headword, definition, part of speech, and example are required.");
  if (item.definition.length > 140) issues.push("Definition must be 140 characters or fewer.");
  if (!LEVELS.includes(item.level)) issues.push("Choose a valid level.");
  if (!item.video || item.video.durationMs < 3000 || item.video.durationMs > 30000) issues.push("Video duration must be 3–30 seconds.");
  if (!item.video.license || !item.video.attribution) issues.push("License and attribution are required.");
  if (!item.video.subtitles.length) issues.push("At least one subtitle cue is required.");
  const lower = item.example.toLowerCase();
  if (!item.forms.some((form) => lower.includes(form.toLowerCase()))) issues.push("One vocabulary form must appear in the example.");
  if (!item.video.subtitles.some((cue) => item.forms.some((form) => cue.text.toLowerCase().includes(form.toLowerCase())))) issues.push("One vocabulary form must appear in a subtitle.");
  let previous = 0;
  for (const cue of item.video.subtitles) {
    if (cue.startMs < previous || cue.startMs < 0 || cue.endMs <= cue.startMs || cue.endMs > item.video.durationMs) issues.push("Subtitle cues must be ordered, non-overlapping, and inside the clip.");
    previous = cue.endMs;
  }
  for (const url of [item.video.url, item.video.poster]) {
    if (url.startsWith("/media/")) {
      const relative = url.slice("/media/".length);
      if (relative.includes("..") || !fs.existsSync(path.join(mediaDir, relative))) issues.push(`Media file not found: ${url}`);
    } else if (!/^https:\/\//.test(url)) issues.push(`Media URL must be HTTPS or local /media/: ${url}`);
  }
  return [...new Set(issues)];
}

export function upsertContent(db: DB, input: ContentItemInput, mediaDir: string, dryRun = false) {
  const issues = contentIssues(input, mediaDir);
  const status = input.status === "published" && issues.length ? "draft" : input.status;
  if (dryRun) return { item: input, publishIssues: issues, status };
  const timestamp = now();
  const existing = db.prepare("SELECT id FROM vocab_items WHERE slug=?").get(input.slug) as any;
  const vocabId = existing?.id || id();
  db.prepare(`INSERT INTO vocab_items (id,slug,headword,forms,part_of_speech,ipa,definition,example_sentence,level,translations,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET headword=excluded.headword,forms=excluded.forms,part_of_speech=excluded.part_of_speech,
    ipa=excluded.ipa,definition=excluded.definition,example_sentence=excluded.example_sentence,level=excluded.level,translations=excluded.translations,updated_at=excluded.updated_at`)
    .run(vocabId, input.slug, input.headword, JSON.stringify(input.forms), input.partOfSpeech, input.ipa || null, input.definition, input.example, input.level, JSON.stringify(input.translations || {}), timestamp, timestamp);
  const videoId = (db.prepare("SELECT id FROM videos WHERE slug=?").get(input.slug) as any)?.id || id();
  db.prepare(`INSERT INTO videos (id,vocab_id,slug,video_url,poster_url,duration_ms,subtitles,source_type,license,attribution,source_url,status,sort_order,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET video_url=excluded.video_url,poster_url=excluded.poster_url,duration_ms=excluded.duration_ms,
    subtitles=excluded.subtitles,source_type=excluded.source_type,license=excluded.license,attribution=excluded.attribution,source_url=excluded.source_url,status=excluded.status,sort_order=excluded.sort_order,updated_at=excluded.updated_at`)
    .run(videoId, vocabId, input.slug, input.video.url, input.video.poster, input.video.durationMs, JSON.stringify(input.video.subtitles), input.video.sourceType, input.video.license, input.video.attribution, input.video.sourceUrl || null, status, input.sortOrder, timestamp, timestamp);
  return { item: input, publishIssues: issues, status };
}

function inputFromRow(row: any): ContentItemInput {
  return {
    slug: row.slug, headword: row.headword, forms: json(row.forms, []), partOfSpeech: row.part_of_speech,
    ipa: row.ipa, definition: row.definition, example: row.example_sentence, level: row.level,
    translations: json(row.translations, {}), status: row.status, sortOrder: row.sort_order,
    video: { url: row.video_url, poster: row.poster_url, durationMs: row.duration_ms, subtitles: json(row.subtitles, []), sourceType: row.source_type, license: row.license, attribution: row.attribution, sourceUrl: row.source_url },
  };
}

export function createApp(options: { db?: DB; mediaDir?: string; webDist?: string } = {}) {
  const db = options.db || openDatabase();
  const mediaDir = path.resolve(options.mediaDir || process.env.MEDIA_DIR || "./media");
  const app = new Hono();
  app.use("*", async (c, next) => {
    const allowed = (process.env.CORS_ORIGINS || "http://localhost:7100,http://127.0.0.1:7100").split(",");
    const origin = c.req.header("origin");
    if (origin && allowed.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });
  const user = (c: any) => userForToken(db, tokenFrom(c));
  const requireUser = (c: any) => {
    const current = user(c);
    if (!current) { fail(c, 401, "UNAUTHORIZED", "Sign in to continue."); return null; }
    return current;
  };
  const requireAdmin = (c: any) => {
    const current = requireUser(c);
    if (!current) return null;
    if (current.role !== "admin") { fail(c, 403, "FORBIDDEN", "Administrator access required."); return null; }
    return current;
  };

  app.get("/api/health", (c) => c.json({ ok: true, service: "LingoLoop API" }));
  app.post("/api/auth/signup", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || String(body.password || "").length < 8) return fail(c, 400, "VALIDATION", "Use a valid email and a password of at least 8 characters.");
    if (db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) return fail(c, 409, "EMAIL_TAKEN", "An account already uses this email.");
    const timestamp = now(), userId = id(), timezone = String(body.timezone || "UTC");
    db.prepare("INSERT INTO users (id,email,password_hash,display_name,level,role,timezone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(userId, email, hashPassword(String(body.password)), String(body.displayName || email.split("@")[0]), null, "learner", timezone, timestamp, timestamp);
    const current = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
    return c.json({ token: createSession(db, userId), user: publicUser(current) }, 201);
  });
  app.post("/api/auth/login", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const current = db.prepare("SELECT * FROM users WHERE email=?").get(String(body.email || "").trim().toLowerCase()) as any;
    if (!current || !verifyPassword(String(body.password || ""), current.password_hash)) return fail(c, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    db.prepare("UPDATE users SET timezone=?,updated_at=? WHERE id=?").run(String(body.timezone || current.timezone), now(), current.id);
    return c.json({ token: createSession(db, current.id), user: publicUser(current) });
  });
  app.post("/api/auth/logout", (c) => {
    const token = tokenFrom(c);
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(crypto.createHash("sha256").update(token).digest("hex"));
    return c.body(null, 204);
  });
  app.get("/api/me", (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    return c.json({ user: publicUser(current), stats: getStats(db, current) });
  });
  app.patch("/api/me", async (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    const body = await c.req.json().catch(() => ({}));
    if (body.level && !LEVELS.includes(body.level)) return fail(c, 400, "VALIDATION", "Invalid English level.");
    db.prepare("UPDATE users SET level=COALESCE(?,level),display_name=COALESCE(?,display_name),timezone=COALESCE(?,timezone),updated_at=? WHERE id=?")
      .run(body.level || null, body.displayName || null, body.timezone || null, now(), current.id);
    return c.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(current.id)) });
  });

  app.get("/api/feed", (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    if (!current.level) return fail(c, 409, "LEVEL_REQUIRED", "Choose your English level first.");
    const limit = Math.min(20, Math.max(1, Number(c.req.query("limit") || 10)));
    let cursor: any = { p: "u" };
    try { if (c.req.query("cursor")) cursor = JSON.parse(Buffer.from(c.req.query("cursor")!, "base64url").toString("utf8")); } catch { /* Start at the unseen phase. */ }
    const rows = db.prepare(`${contentSelect} LEFT JOIN video_views w ON w.video_id=v.id AND w.user_id=?
      WHERE v.status='published' AND x.level=? ORDER BY v.sort_order,v.id`).all(current.id, current.level) as any[];
    const afterCursor = (row: any) => cursor.p !== "u" || !cursor.i || row.sort_order > cursor.s || (row.sort_order === cursor.s && String(row.video_id).localeCompare(String(cursor.i)) > 0);
    const unseen = cursor.p === "r" ? [] : rows.filter((row) => !row.last_viewed_at && afterCursor(row));
    const review = rows.filter((row) => row.last_viewed_at).sort((a, b) => String(a.last_viewed_at).localeCompare(String(b.last_viewed_at)) || String(a.video_id).localeCompare(String(b.video_id)));
    const page = unseen.slice(0, limit).map((row) => ({ row, review: false }));
    let nextCursor: string | null = null;
    if (unseen.length > limit) {
      const last = page[page.length - 1].row;
      nextCursor = Buffer.from(JSON.stringify({ p: "u", s: last.sort_order, i: last.video_id })).toString("base64url");
    } else {
      const reviewOffset = cursor.p === "r" ? Math.max(0, Number(cursor.o || 0)) : 0;
      const remaining = limit - page.length;
      const reviewPage = review.slice(reviewOffset, reviewOffset + remaining);
      page.push(...reviewPage.map((row) => ({ row, review: true })));
      if (reviewOffset + reviewPage.length < review.length) nextCursor = Buffer.from(JSON.stringify({ p: "r", o: reviewOffset + reviewPage.length })).toString("base64url");
    }
    return c.json({ items: page.map(({ row, review }) => feedRow(db, current, row, review)), nextCursor });
  });
  app.post("/api/progress/view", async (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    const body = await c.req.json().catch(() => ({}));
    const timestamp = now();
    const exists = db.prepare("SELECT 1 FROM videos WHERE id=? AND status='published'").get(body.videoId);
    if (!exists) return fail(c, 404, "NOT_FOUND", "Video not found.");
    db.prepare(`INSERT INTO video_views (user_id,video_id,first_viewed_at,last_viewed_at,view_count) VALUES (?,?,?,?,1)
      ON CONFLICT(user_id,video_id) DO UPDATE SET last_viewed_at=excluded.last_viewed_at,view_count=video_views.view_count+1`)
      .run(current.id, body.videoId, timestamp, timestamp);
    let xpAwarded = 0;
    if (body.event === "complete") {
      const result = db.prepare("UPDATE video_views SET completed_at=COALESCE(completed_at,?) WHERE user_id=? AND video_id=?").run(timestamp, current.id, body.videoId);
      if (result.changes) xpAwarded = award(db, current, "view_complete", body.videoId, XP_VIEW);
    }
    return c.json({ xpAwarded, stats: getStats(db, current) });
  });

  app.get("/api/saved", (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    const rows = db.prepare(`${contentSelect} JOIN saved_words s ON s.vocab_id=x.id AND s.user_id=?
      LEFT JOIN video_views w ON w.video_id=v.id AND w.user_id=? ORDER BY s.saved_at DESC`).all(current.id, current.id) as any[];
    return c.json({ items: rows.map((row) => ({ ...feedRow(db, current, row), savedAt: (db.prepare("SELECT saved_at FROM saved_words WHERE user_id=? AND vocab_id=?").get(current.id, row.vocab_id) as any).saved_at })) });
  });
  app.put("/api/saved/:vocabId", (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    db.prepare("INSERT OR IGNORE INTO saved_words (user_id,vocab_id,saved_at) VALUES (?,?,?)").run(current.id, c.req.param("vocabId"), now());
    return c.body(null, 204);
  });
  app.delete("/api/saved/:vocabId", (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    db.prepare("DELETE FROM saved_words WHERE user_id=? AND vocab_id=?").run(current.id, c.req.param("vocabId"));
    return c.body(null, 204);
  });

  app.post("/api/quizzes", (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    const pool = db.prepare(`${contentSelect} JOIN video_views w ON w.video_id=v.id AND w.user_id=? AND w.completed_at IS NOT NULL
      WHERE v.status='published' ORDER BY w.completed_at DESC LIMIT 30`).all(current.id) as any[];
    if (pool.length < QUIZ_MIN_WORDS) return fail(c, 409, "NOT_ENOUGH_WORDS", `Complete ${QUIZ_MIN_WORDS - pool.length} more words to unlock a quiz.`, { have: pool.length, need: QUIZ_MIN_WORDS });
    const targets = shuffle(pool).slice(0, Math.min(QUIZ_SIZE, pool.length));
    const distractors = db.prepare(`${contentSelect} LEFT JOIN video_views w ON 1=0 WHERE v.status='published'`).all() as any[];
    const questions = targets.map((target, index) => {
      const context = index % 2 === 1;
      const matched = target.forms && json(target.forms, []).find((form: string) => target.example_sentence.toLowerCase().includes(form.toLowerCase()));
      const prompt = context && matched ? target.example_sentence.replace(new RegExp(matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "_____") : `What does “${target.headword}” mean?`;
      const candidates = shuffle(distractors.filter((other) => other.vocab_id !== target.vocab_id && other.level === target.level));
      const options = shuffle([target, ...candidates.slice(0, 3)]).map((row, optionIndex) => ({ id: String.fromCharCode(97 + optionIndex), text: context && matched ? row.headword : row.definition }));
      const correctText = context && matched ? target.headword : target.definition;
      return { index, type: context && matched ? "context" : "meaning", prompt, options, correctOptionId: options.find((option) => option.text === correctText)?.id || "a", word: { headword: target.headword, definition: target.definition } };
    });
    const attemptId = id();
    db.prepare("INSERT INTO quiz_attempts (id,user_id,questions,total,created_at) VALUES (?,?,?,?,?)").run(attemptId, current.id, JSON.stringify(questions), questions.length, now());
    return c.json({ id: attemptId, questions: questions.map(({ correctOptionId, word, ...question }) => question) }, 201);
  });
  app.post("/api/quizzes/:id/answers", async (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    const attempt = db.prepare("SELECT * FROM quiz_attempts WHERE id=? AND user_id=?").get(c.req.param("id"), current.id) as any;
    if (!attempt) return fail(c, 404, "NOT_FOUND", "Quiz not found.");
    const body = await c.req.json().catch(() => ({}));
    const answers = json(attempt.answers, {}) as any;
    if (answers[body.index]) return fail(c, 409, "ALREADY_ANSWERED", "This question was already answered.");
    const questions = json(attempt.questions, []) as any[];
    const question = questions[Number(body.index)];
    if (!question) return fail(c, 400, "VALIDATION", "Invalid question index.");
    const correct = question.correctOptionId === body.optionId;
    answers[body.index] = { optionId: body.optionId, correct };
    db.prepare("UPDATE quiz_attempts SET answers=?,score=score+? WHERE id=?").run(JSON.stringify(answers), correct ? 1 : 0, attempt.id);
    return c.json({ correct, correctOptionId: question.correctOptionId, xpAwarded: correct ? award(db, current, "quiz_correct", `${attempt.id}:${body.index}`, XP_QUIZ_CORRECT) : 0, word: question.word });
  });
  app.post("/api/quizzes/:id/complete", (c) => {
    const current = requireUser(c); if (!current) return c.body(null, 401);
    const attempt = db.prepare("SELECT * FROM quiz_attempts WHERE id=? AND user_id=?").get(c.req.param("id"), current.id) as any;
    if (!attempt) return fail(c, 404, "NOT_FOUND", "Quiz not found.");
    if (!attempt.completed_at) db.prepare("UPDATE quiz_attempts SET completed_at=? WHERE id=?").run(now(), attempt.id);
    return c.json({ score: attempt.score, total: attempt.total, xpAwarded: attempt.completed_at ? 0 : award(db, current, "quiz_complete", attempt.id, XP_QUIZ_COMPLETE) });
  });

  app.get("/api/admin/content", (c) => {
    if (!requireAdmin(c)) return c.body(null, 403);
    const rows = db.prepare(`${contentSelect} LEFT JOIN video_views w ON 1=0 ORDER BY v.sort_order,v.id`).all() as any[];
    return c.json({ items: rows.map((row) => ({ ...inputFromRow(row), publishIssues: contentIssues(inputFromRow(row), mediaDir) })) });
  });
  app.get("/api/admin/content/:slug", (c) => {
    if (!requireAdmin(c)) return c.body(null, 403);
    const row = db.prepare(`${contentSelect} LEFT JOIN video_views w ON 1=0 WHERE v.slug=?`).get(c.req.param("slug")) as any;
    if (!row) return fail(c, 404, "NOT_FOUND", "Content item not found.");
    return c.json({ item: inputFromRow(row), publishIssues: contentIssues(inputFromRow(row), mediaDir) });
  });
  app.put("/api/admin/content/:slug", async (c) => {
    if (!requireAdmin(c)) return c.body(null, 403);
    const body = await c.req.json().catch(() => null);
    if (!body || body.slug !== c.req.param("slug")) return fail(c, 400, "VALIDATION", "Content slug does not match the route.");
    const result = upsertContent(db, body, mediaDir);
    return c.json(result);
  });
  app.post("/api/admin/content/:slug/status", async (c) => {
    if (!requireAdmin(c)) return c.body(null, 403);
    const body = await c.req.json().catch(() => ({}));
    if (!["draft", "published", "archived"].includes(body.status)) return fail(c, 400, "VALIDATION", "Invalid status.");
    const row = db.prepare(`${contentSelect} LEFT JOIN video_views w ON 1=0 WHERE v.slug=?`).get(c.req.param("slug")) as any;
    if (!row) return fail(c, 404, "NOT_FOUND", "Content item not found.");
    const issues = contentIssues(inputFromRow(row), mediaDir);
    if (body.status === "published" && issues.length) return fail(c, 422, "PUBLISH_BLOCKED", "Fix publishing issues first.", { issues });
    db.prepare("UPDATE videos SET status=?,updated_at=? WHERE slug=?").run(body.status, now(), row.slug);
    return c.json({ status: body.status });
  });
  app.post("/api/admin/import", async (c) => {
    if (!requireAdmin(c)) return c.body(null, 403);
    const body = await c.req.json().catch(() => []);
    if (!Array.isArray(body) || body.length > 500) return fail(c, 400, "VALIDATION", "Send an array of up to 500 content items.");
    const dryRun = c.req.query("dryRun") === "1";
    let created = 0, updated = 0, drafted = 0;
    const errors: any[] = [];
    body.forEach((item, index) => {
      try {
        const exists = db.prepare("SELECT 1 FROM vocab_items WHERE slug=?").get(item.slug);
        const result = upsertContent(db, item, mediaDir, dryRun);
        if (result.publishIssues.length) { drafted++; errors.push({ index, slug: item.slug, issues: result.publishIssues }); }
        if (exists) updated++; else created++;
      } catch (error: any) { errors.push({ index, slug: item?.slug, issues: [error.message] }); }
    });
    return c.json({ created, updated, drafted, errors });
  });
  app.get("/api/admin/export", (c) => {
    if (!requireAdmin(c)) return c.body(null, 403);
    const rows = db.prepare(`${contentSelect} LEFT JOIN video_views w ON 1=0 ORDER BY v.sort_order,v.id`).all() as any[];
    return c.json(rows.map(inputFromRow));
  });
  app.post("/api/admin/media", async (c) => {
    if (!requireAdmin(c)) return c.body(null, 403);
    const body = await c.req.parseBody();
    const file = body.file as any;
    const slug = String(body.slug || "");
    const kind = String(body.kind || "video");
    if (!file || !/^[a-z0-9-]{2,60}$/.test(slug) || !["video", "poster"].includes(kind)) return fail(c, 400, "VALIDATION", "A file, valid slug, and media kind are required.");
    const extension = kind === "video" ? "mp4" : String(file.name || "").split(".").pop()?.toLowerCase();
    if (kind === "video" && !String(file.name).toLowerCase().endsWith(".mp4")) return fail(c, 400, "VALIDATION", "Only MP4 videos are supported.");
    if (kind === "poster" && !["jpg", "jpeg", "png", "webp"].includes(extension || "")) return fail(c, 400, "VALIDATION", "Poster must be JPG, PNG, or WebP.");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 50 * 1024 * 1024) return fail(c, 413, "TOO_LARGE", "Media must be 50 MB or smaller.");
    const directory = kind === "video" ? "clips" : "posters";
    fs.mkdirSync(path.join(mediaDir, directory), { recursive: true });
    fs.writeFileSync(path.join(mediaDir, directory, `${slug}.${extension}`), buffer);
    return c.json({ url: `/media/${directory}/${slug}.${extension}` }, 201);
  });

  app.use("/media/*", serveStatic({ root: mediaDir, rewriteRequestPath: (requestPath) => requestPath.replace(/^\/media/, "") }));
  if (options.webDist) {
    const dist = path.resolve(options.webDist);
    app.use("/*", serveStatic({ root: dist }));
    app.get("*", serveStatic({ path: path.join(dist, "index.html") }));
  }
  app.notFound((c) => fail(c, 404, "NOT_FOUND", "Route not found."));
  app.onError((error, c) => { console.error(error); return fail(c, 500, "INTERNAL", "Unexpected server error."); });
  return app;
}
