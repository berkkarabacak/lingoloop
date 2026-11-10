import fs from "node:fs";
import path from "node:path";
import { createApp, upsertContent } from "../src/app.ts";
import { hashPassword, id, now, openDatabase } from "../src/db.ts";

const items = JSON.parse(fs.readFileSync(path.resolve("../content/seed.json"), "utf8"));
const db = openDatabase();
const mediaDir = path.resolve("./media");
for (const item of items) upsertContent(db, item, mediaDir);
const timestamp = now();
for (const account of [
  { email: "demo@lingoloop.local", password: "learn123", role: "learner", level: "intermediate" },
  { email: "admin@lingoloop.local", password: "admin123", role: "admin", level: "intermediate" },
]) {
  if (!db.prepare("SELECT 1 FROM users WHERE email=?").get(account.email)) {
    db.prepare("INSERT INTO users (id,email,password_hash,display_name,level,role,timezone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id(), account.email, hashPassword(account.password), account.role === "admin" ? "Curator" : "Demo Learner", account.level, account.role, "Europe/Istanbul", timestamp, timestamp);
  }
}
console.log(`Seeded ${items.length} content items and demo accounts.`);
db.close();
