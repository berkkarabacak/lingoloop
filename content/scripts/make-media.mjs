import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const items = JSON.parse(fs.readFileSync(path.join(root, "content/seed.json"), "utf8"));
const posters = path.join(root, "server/media/posters");
const clips = path.join(root, "server/media/clips");
fs.mkdirSync(posters, { recursive: true });
fs.mkdirSync(clips, { recursive: true });
const posterResult = spawnSync("python", [path.join(root, "content/scripts/make-posters.py")], { cwd: root, stdio: "inherit" });
if (posterResult.status !== 0) process.exit(posterResult.status || 1);
for (const item of items) {
  const output = path.join(clips, `${item.slug}.mp4`);
  const result = spawnSync(ffmpegPath, [
    "-y", "-loop", "1", "-i", path.join(posters, `${item.slug}.jpg`),
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "8",
    "-vf", "scale=720:1280,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast",
    "-crf", "28", "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart", "-shortest", output,
  ], { stdio: "ignore" });
  if (result.status !== 0) {
    console.error(`ffmpeg failed for ${item.slug}`);
    process.exit(result.status || 1);
  }
}
console.log(`Created ${items.length} placeholder clips`);
