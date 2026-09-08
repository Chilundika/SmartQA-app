import type { Session } from "../types/index.ts";

export const SESSION_KEY_PREFIX = "rsm_session_";
export const SESSION_INDEX_KEY = "rsm_session_index";

/** Lightweight entry kept in the index so the "load previous session" screen doesn't have to parse every blob. */
export type SessionSummary = {
  sessionId: string;
  moduleName: string;
  dateCreated: string;
  /** ISO timestamp of the most recent save. */
  savedAt: string;
};

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

export function sessionKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

/** localStorage is absent during Next.js server rendering and can throw in private/locked-down browsers. */
function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.sessionId === "string" &&
    typeof s.moduleName === "string" &&
    typeof s.dateCreated === "string" &&
    Array.isArray(s.students) &&
    Array.isArray(s.questions) &&
    Array.isArray(s.matches)
  );
}

function readIndex(storage: Storage): SessionSummary[] {
  try {
    const raw = storage.getItem(SESSION_INDEX_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e): e is SessionSummary => typeof e?.sessionId === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIndex(storage: Storage, index: SessionSummary[]): void {
  storage.setItem(SESSION_INDEX_KEY, JSON.stringify(index));
}

function toSummary(session: Session, savedAt: string): SessionSummary {
  return {
    sessionId: session.sessionId,
    moduleName: session.moduleName,
    dateCreated: session.dateCreated,
    savedAt,
  };
}

/**
 * Persists the whole session as one JSON blob and upserts its index entry.
 * Returns a result rather than throwing so the UI can drive a "Saved" / "Save failed" indicator (PRD §8).
 */
export function saveSession(session: Session): SaveResult {
  const storage = getStorage();
  if (!storage) return { ok: false, error: "localStorage is not available in this environment." };

  const savedAt = new Date().toISOString();
  try {
    storage.setItem(sessionKey(session.sessionId), JSON.stringify(session));

    const index = readIndex(storage).filter((e) => e.sessionId !== session.sessionId);
    index.push(toSummary(session, savedAt));
    writeIndex(storage, index);

    return { ok: true, savedAt };
  } catch (err) {
    const isQuota = err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22);
    return {
      ok: false,
      error: isQuota
        ? "Browser storage is full. Delete old sessions to free up space."
        : `Could not save session: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Returns the session, or `null` if it doesn't exist or the stored blob is unreadable. */
export function loadSession(sessionId: string): Session | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(sessionKey(sessionId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * All saved sessions, most recently saved first. Entries whose blob has gone
 * missing are pruned from the index; blobs missing from the index are recovered
 * by scanning keys with the `rsm_session_` prefix, so the list stays truthful.
 */
export function listSessions(): SessionSummary[] {
  const storage = getStorage();
  if (!storage) return [];

  const indexed = new Map(readIndex(storage).map((e) => [e.sessionId, e]));
  const result: SessionSummary[] = [];
  let indexChanged = false;

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !key.startsWith(SESSION_KEY_PREFIX)) continue;
    const sessionId = key.slice(SESSION_KEY_PREFIX.length);

    const entry = indexed.get(sessionId);
    if (entry) {
      result.push(entry);
      indexed.delete(sessionId);
      continue;
    }

    const session = loadSession(sessionId);
    if (session) {
      result.push(toSummary(session, session.dateCreated));
      indexChanged = true;
    }
  }

  // Anything still in `indexed` points at a blob that no longer exists.
  if (indexed.size > 0) indexChanged = true;

  result.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  if (indexChanged) {
    try {
      writeIndex(storage, result);
    } catch {
      // Index repair is best-effort; the returned list is still correct.
    }
  }
  return result;
}

/** Removes the session blob and its index entry. Returns `true` if a session existed. */
export function deleteSession(sessionId: string): boolean {
  const storage = getStorage();
  if (!storage) return false;

  const key = sessionKey(sessionId);
  const existed = storage.getItem(key) !== null;
  storage.removeItem(key);

  try {
    writeIndex(
      storage,
      readIndex(storage).filter((e) => e.sessionId !== sessionId),
    );
  } catch {
    // The blob is gone; listSessions() will drop the stale entry on its next call.
  }
  return existed;
}

/** Writes a session blob without bumping the index timestamp (used for bulk field patches). */
export function writeSessionBlob(session: Session): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(sessionKey(session.sessionId), JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}
