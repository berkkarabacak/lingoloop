export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Beginner · A1–A2",
  intermediate: "Intermediate · B1–B2",
  advanced: "Advanced · C1–C2",
};
export const XP_VIEW = 5;
export const XP_QUIZ_CORRECT = 10;
export const XP_QUIZ_COMPLETE = 20;
export const QUIZ_MIN_WORDS = 4;
export const QUIZ_SIZE = 5;

export interface Cue { startMs: number; endMs: number; text: string }
export interface ContentVideoInput {
  url: string;
  poster: string;
  durationMs: number;
  subtitles: Cue[];
  sourceType: "real" | "ai_generated" | "placeholder";
  license: string;
  attribution: string;
  sourceUrl?: string | null;
}
export interface ContentItemInput {
  slug: string;
  headword: string;
  forms: string[];
  partOfSpeech: string;
  ipa?: string | null;
  definition: string;
  example: string;
  level: Level;
  translations?: Record<string, string>;
  status: "draft" | "published" | "archived";
  sortOrder: number;
  video: ContentVideoInput;
}
export interface FeedItem {
  videoId: string;
  vocabId: string;
  slug: string;
  headword: string;
  forms: string[];
  partOfSpeech: string;
  ipa: string | null;
  definition: string;
  example: string;
  level: Level;
  videoUrl: string;
  posterUrl: string;
  durationMs: number;
  subtitles: Cue[];
  sourceType: ContentVideoInput["sourceType"];
  license: string;
  attribution: string;
  saved: boolean;
  seen: boolean;
  isReview: boolean;
}
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  level: Level | null;
  role: "learner" | "admin";
  timezone: string;
}
export interface Stats {
  xpTotal: number;
  xpToday: number;
  streakCurrent: number;
  streakBest: number;
  wordsLearned: number;
  wordsSaved: number;
  quizzesCompleted: number;
  quizAccuracy: number;
  last7Days: { date: string; xp: number }[];
}
export interface QuizOption { id: string; text: string }
export interface QuizQuestion {
  index: number;
  type: "meaning" | "context";
  prompt: string;
  options: QuizOption[];
}
export interface SavedWord extends FeedItem { savedAt: string }

export function activeCue(cues: Cue[], timeMs: number): Cue | null {
  return cues.find((cue) => timeMs >= cue.startMs && timeMs < cue.endMs) || null;
}

export type HighlightPart = { text: string; hit: boolean };
export function splitHighlight(text: string, forms: string[]): HighlightPart[] {
  const ordered = [...new Set(forms)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!ordered.length) return [{ text, hit: false }];
  const pattern = ordered.map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")).join("|");
  const regex = new RegExp(`\\b(?:${pattern})\\b`, "gi");
  const parts: HighlightPart[] = [];
  let last = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), hit: false });
    parts.push({ text: match[0], hit: true });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}

export function parseCueText(value: string): Cue[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\s*-->\s*(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\s*\|\s*(.+)$/);
    if (!match) throw new Error(`Invalid cue: ${line}`);
    const startMs = (Number(match[1]) * 60 + Number(match[2])) * 1000 + Number((match[3] || "0").padEnd(3, "0"));
    const endMs = (Number(match[4]) * 60 + Number(match[5])) * 1000 + Number((match[6] || "0").padEnd(3, "0"));
    return { startMs, endMs, text: match[7].trim() };
  });
}

export function formatCueText(cues: Cue[]): string {
  const stamp = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
  return cues.map((cue) => `${stamp(cue.startMs)} --> ${stamp(cue.endMs)} | ${cue.text}`).join("\n");
}
