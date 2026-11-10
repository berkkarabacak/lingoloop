import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type DB = DatabaseSync;

export function openDatabase(filename = process.env.DB_PATH || "./data/lingoloop.db"): DB {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, display_name TEXT, level TEXT,
      role TEXT NOT NULL DEFAULT 'learner', timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vocab_items (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, headword TEXT NOT NULL,
      forms TEXT NOT NULL, part_of_speech TEXT NOT NULL, ipa TEXT,
      definition TEXT NOT NULL, example_sentence TEXT NOT NULL, level TEXT NOT NULL,
      translations TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY, vocab_id TEXT NOT NULL REFERENCES vocab_items(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE, video_url TEXT NOT NULL, poster_url TEXT NOT NULL,
      duration_ms INTEGER NOT NULL, subtitles TEXT NOT NULL, source_type TEXT NOT NULL,
      license TEXT NOT NULL, attribution TEXT NOT NULL, source_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS videos_feed ON videos(status, sort_order, id);
    CREATE TABLE IF NOT EXISTS video_views (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      first_viewed_at TEXT NOT NULL, last_viewed_at TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 1, completed_at TEXT,
      PRIMARY KEY(user_id, video_id)
    );
    CREATE TABLE IF NOT EXISTS saved_words (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vocab_id TEXT NOT NULL REFERENCES vocab_items(id) ON DELETE CASCADE,
      saved_at TEXT NOT NULL, PRIMARY KEY(user_id, vocab_id)
    );
    CREATE TABLE IF NOT EXISTS xp_events (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, ref_id TEXT NOT NULL, amount INTEGER NOT NULL,
      local_date TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(user_id, kind, ref_id)
    );
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      questions TEXT NOT NULL, answers TEXT NOT NULL DEFAULT '{}', score INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL, created_at TEXT NOT NULL, completed_at TEXT
    );
  `);
  return db;
}

export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const json = <T>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, salt, expected] = stored.split("$");
  if (kind !== "scrypt" || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, Buffer.from(salt, "base64url"), 64);
  const target = Buffer.from(expected, "base64url");
  return target.length === actual.length && crypto.timingSafeEqual(actual, target);
}

export function createSession(db: DB, userId: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  const timestamp = now();
  const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  db.prepare("INSERT INTO sessions (token_hash,user_id,created_at,expires_at,last_seen_at) VALUES (?,?,?,?,?)")
    .run(crypto.createHash("sha256").update(token).digest("hex"), userId, timestamp, expires, timestamp);
  return token;
}

export function userForToken(db: DB, token?: string): any | null {
  if (!token) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const user = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?`).get(hash, now()) as any;
  if (user) db.prepare("UPDATE sessions SET last_seen_at=? WHERE token_hash=?").run(now(), hash);
  return user || null;
}

export function publicUser(row: any) {
  return row ? {
    id: row.id, email: row.email, displayName: row.display_name,
    level: row.level, role: row.role, timezone: row.timezone,
  } : null;
}

export function localDate(timezone: string, date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch { return new Intl.DateTimeFormat("en-CA").format(date); }
}
