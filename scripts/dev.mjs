import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiPort = process.env.API_PORT || "4000";
const webPort = process.env.WEB_PORT || "7100";
const webEnv = { ...process.env, EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || `http://127.0.0.1:${apiPort}` };
const serverEnv = { ...process.env, PORT: apiPort, HOST: "127.0.0.1", CORS_ORIGINS: process.env.CORS_ORIGINS || `http://localhost:${webPort},http://127.0.0.1:${webPort}` };
const children = [
  spawn(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "src/index.ts"], { cwd: path.join(root, "server"), env: serverEnv, stdio: "inherit" }),
  spawn(process.execPath, [path.join(root, "node_modules/expo/bin/cli"), "start", "--web", "--port", webPort, ...process.argv.slice(2)], { cwd: path.join(root, "mobile"), env: webEnv, stdio: "inherit" }),
];
let closing = false;
function stopChild(child) {
  if (child.killed) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}
function close(code = 0) {
  if (closing) return;
  closing = true;
  children.forEach(stopChild);
  setTimeout(() => process.exit(code), 300).unref();
}
for (const child of children) child.on("exit", (code) => close(code || 0));
process.on("SIGINT", () => close(0));
process.on("SIGTERM", () => close(0));
