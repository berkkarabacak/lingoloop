import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError, api } from "../api/client";
import type { Stats } from "@lingoloop/shared";

type PendingCompletion = { videoId: string; fallback: boolean; enqueuedAt: string };
type CompletionResponse = { xpAwarded: number; stats: Stats };

const keyFor = (userId: string) => `lingoloop.completions.${userId}`;
const flushing = new Set<string>();

async function readQueue(userId: string): Promise<PendingCompletion[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PendingCompletion => Boolean(
      entry && typeof entry.videoId === "string" && typeof entry.fallback === "boolean" && typeof entry.enqueuedAt === "string",
    ));
  } catch {
    return [];
  }
}

async function writeQueue(userId: string, queue: PendingCompletion[]) {
  const key = keyFor(userId);
  if (queue.length) await AsyncStorage.setItem(key, JSON.stringify(queue));
  else await AsyncStorage.removeItem(key);
}

export async function enqueueCompletion(userId: string, videoId: string, fallback: boolean) {
  const queue = await readQueue(userId);
  if (!queue.some((entry) => entry.videoId === videoId)) {
    queue.push({ videoId, fallback, enqueuedAt: new Date().toISOString() });
    await writeQueue(userId, queue);
  }
}

export async function pendingCompletionCount(userId: string) {
  return (await readQueue(userId)).length;
}

export async function flushCompletionQueue(userId: string) {
  if (flushing.has(userId)) return { flushed: 0, xpAwarded: 0, pending: await pendingCompletionCount(userId) };
  flushing.add(userId);
  let flushed = 0;
  let xpAwarded = 0;
  try {
    const queue = await readQueue(userId);
    const remaining: PendingCompletion[] = [];
    for (const entry of queue) {
      try {
        const result = await api<CompletionResponse>("/api/progress/view", {
          method: "POST",
          body: JSON.stringify({ videoId: entry.videoId, event: "complete", fallback: entry.fallback }),
        });
        flushed += 1;
        xpAwarded += result.xpAwarded;
      } catch (reason) {
        if (reason instanceof ApiError && reason.status !== 0) continue;
        remaining.push(entry);
        const index = queue.indexOf(entry);
        remaining.push(...queue.slice(index + 1));
        break;
      }
    }
    await writeQueue(userId, remaining);
    return { flushed, xpAwarded, pending: remaining.length };
  } finally {
    flushing.delete(userId);
  }
}
