import type { Session } from "../types/index.ts";

export const MAX_SCORE_CAP = 100;

/** `null` means scoring is off (blank Max score on setup, or older sessions). */
export function sessionMaxScore(session: Session): number | null {
  if (typeof session.maxScore !== "number" || !Number.isFinite(session.maxScore)) return null;
  const n = Math.floor(session.maxScore);
  if (n < 1) return null;
  return Math.min(MAX_SCORE_CAP, n);
}

export function clampAwardedScore(score: number, maxScore: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(maxScore, Math.max(0, Math.round(score)));
}

export function parseMaxScoreInput(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > MAX_SCORE_CAP) return "invalid";
  return n;
}
