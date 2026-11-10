import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], {
  cwd: path.join(root, "server"),
  env: { ...process.env, PORT: process.env.PORT || "4000", HOST: process.env.HOST || "127.0.0.1", WEB_DIST: "../mobile/dist" },
  stdio: "inherit",
});
process.on("SIGINT", () => child.kill("SIGTERM"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code || 0));
