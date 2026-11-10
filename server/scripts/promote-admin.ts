import { openDatabase } from "../src/db.ts";

const emailIndex = process.argv.indexOf("--email");
const email = emailIndex >= 0 ? process.argv[emailIndex + 1] : "";
if (!email) throw new Error("Usage: npm run admin:promote -- --email you@example.com");
const db = openDatabase();
const result = db.prepare("UPDATE users SET role='admin',updated_at=? WHERE email=?").run(new Date().toISOString(), email.toLowerCase());
if (!result.changes) throw new Error(`No user found for ${email}`);
console.log(`${email} is now an administrator.`);
db.close();
