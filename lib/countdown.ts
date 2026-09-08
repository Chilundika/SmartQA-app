import type { Session } from "../types/index.ts";
import { listSessions, loadSession, writeSessionBlob } from "./sessionStorage.ts";

export const DEFAULT_COUNTDOWN_SECONDS = 120;
export const COUNTDOWN_PREF_KEY = "rsm_countdown_seconds";
export const COUNTDOWN_CHANGED_EVENT = "rsm-countdown-changed";

export function readGlobalCountdownSeconds(): number | null {
  try {
    const raw = localStorage.getItem(COUNTDOWN_PREF_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  } catch {
    return null;
  }
}

export function persistConfirmedCountdownSeconds(seconds: number): void {
  try {
    localStorage.setItem(COUNTDOWN_PREF_KEY, String(Math.max(0, Math.floor(seconds))));
  } catch {
    /* private mode */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COUNTDOWN_CHANGED_EVENT));
  }
}

/** `0` means the lecturer turned the timer off. Missing on older sessions → default 2 minutes. */
export function resolveCountdownSeconds(session: Session): number {
  if (typeof session.countdownSeconds !== "number" || !Number.isFinite(session.countdownSeconds)) {
    const global = readGlobalCountdownSeconds();
    if (global !== null) return global;
    return DEFAULT_COUNTDOWN_SECONDS;
  }
  return Math.max(0, Math.floor(session.countdownSeconds));
}

/**
 * Stores the confirmed duration as a device-wide preference and writes it onto
 * every saved session so previously created sessions use the same per-question timer.
 */
export function applyConfirmedCountdownToAllSessions(seconds: number): number {
  const value = Math.max(0, Math.floor(seconds));

  let updated = 0;
  for (const summary of listSessions()) {
    const session = loadSession(summary.sessionId);
    if (!session) continue;
    if (session.countdownSeconds === value) {
      updated += 1;
      continue;
    }
    if (writeSessionBlob({ ...session, countdownSeconds: value })) updated += 1;
  }

  persistConfirmedCountdownSeconds(value);
  return updated;
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m)}:${String(r).padStart(2, "0")}`;
}
