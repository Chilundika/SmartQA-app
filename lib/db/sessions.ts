import type { MatchRecord, Question, Session, Student } from "../../types/index.ts";
import { createClient } from "../supabase/client.ts";
import { formatDbError, logSupabaseError } from "./errors.ts";
import { deleteMatchesForSession, ensureStudents, listMatches, replaceSessionMatches } from "./matches.ts";

export type SessionSummary = {
  sessionId: string;
  moduleName: string;
  dateCreated: string;
  savedAt: string;
};

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

type SessionLiveState = {
  dateCreated?: string;
  students?: Student[];
  questions?: Question[];
  matches?: MatchRecord[];
  currentMatch?: Session["currentMatch"];
  countdownSeconds?: number;
  savedAt?: string;
};

type SessionRow = {
  session_id: string;
  module_name: string;
  date_created: string;
  max_score: number | null;
  state: SessionLiveState | null;
};

function isStudent(value: unknown): value is Student {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.studentNumber === "string" && typeof s.fullName === "string";
}

function isQuestion(value: unknown): value is Question {
  if (typeof value !== "object" || value === null) return false;
  const q = value as Record<string, unknown>;
  return typeof q.id === "string" && typeof q.questionId === "string" && typeof q.questionText === "string";
}

function isMatch(value: unknown): value is MatchRecord {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return typeof m.matchId === "string" && typeof m.outcome === "string" && isStudent(m.student) && isQuestion(m.question);
}

function parseState(value: unknown): SessionLiveState {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;
  const students = Array.isArray(raw.students) ? raw.students.filter(isStudent) : undefined;
  const questions = Array.isArray(raw.questions) ? raw.questions.filter(isQuestion) : undefined;
  const matches = Array.isArray(raw.matches) ? raw.matches.filter(isMatch) : undefined;
  return {
    ...(typeof raw.dateCreated === "string" ? { dateCreated: raw.dateCreated } : {}),
    ...(students ? { students } : {}),
    ...(questions ? { questions } : {}),
    ...(matches ? { matches } : {}),
    ...("currentMatch" in raw ? { currentMatch: raw.currentMatch as Session["currentMatch"] } : {}),
    ...(typeof raw.countdownSeconds === "number" ? { countdownSeconds: raw.countdownSeconds } : {}),
    ...(typeof raw.savedAt === "string" ? { savedAt: raw.savedAt } : {}),
  };
}

function dateCreatedDisplay(row: SessionRow, state: SessionLiveState): string {
  if (state.dateCreated) return state.dateCreated;
  const iso = row.date_created;
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  return iso;
}

function toDateCreated(dateCreated: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateCreated)) return `${dateCreated}T00:00:00`;
  return dateCreated;
}

function toLiveState(session: Session, savedAt: string): SessionLiveState {
  return {
    dateCreated: session.dateCreated,
    students: session.students,
    questions: session.questions,
    matches: session.matches,
    currentMatch: session.currentMatch ?? null,
    ...(typeof session.countdownSeconds === "number" ? { countdownSeconds: session.countdownSeconds } : {}),
    savedAt,
  };
}

function toSummary(row: SessionRow, state: SessionLiveState): SessionSummary {
  const dateCreated = dateCreatedDisplay(row, state);
  return {
    sessionId: row.session_id,
    moduleName: row.module_name,
    dateCreated,
    savedAt: state.savedAt || row.date_created,
  };
}

async function persistSession(session: Session, savedAt: string): Promise<SaveResult> {
  try {
    const studentResult = await ensureStudents(session.students);
    if (!studentResult.ok) return studentResult;

    const supabase = createClient();
    const payload = {
      session_id: session.sessionId,
      module_name: session.moduleName,
      date_created: toDateCreated(session.dateCreated),
      max_score: typeof session.maxScore === "number" ? session.maxScore : null,
      state: toLiveState(session, savedAt),
    };
    const { data, error, status } = await supabase
      .from("sessions")
      .upsert(payload)
      .select("session_id")
      .maybeSingle();
    if (error) {
      logSupabaseError("sessions.upsert", error, {
        sessionId: session.sessionId,
        status,
        matchCount: session.matches.length,
      });
      return { ok: false, error: formatDbError("Could not save session:", error) };
    }
    if (!data?.session_id) {
      console.error("[SmartQA] sessions.upsert returned no row", {
        sessionId: session.sessionId,
        status,
        matchCount: session.matches.length,
      });
      return {
        ok: false,
        error:
          "Could not save session: the database accepted the request but did not return a sessions row. Check RLS INSERT/SELECT policies on public.sessions.",
      };
    }

    const matchesResult = await replaceSessionMatches(session.sessionId, session.matches);
    if (!matchesResult.ok) return matchesResult;

    return { ok: true, savedAt };
  } catch (err) {
    logSupabaseError("sessions.persist threw", err, { sessionId: session.sessionId });
    return {
      ok: false,
      error: `Could not save session: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Creates or updates a session and replaces its match rows. */
export async function saveSession(session: Session): Promise<SaveResult> {
  return persistSession(session, new Date().toISOString());
}

export async function createSession(session: Session): Promise<SaveResult> {
  return saveSession(session);
}

export async function loadSession(sessionId: string): Promise<Session | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sessions")
      .select("session_id, module_name, date_created, max_score, state")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      logSupabaseError("sessions.select", error, { sessionId });
      return null;
    }
    if (!data) return null;

    const row = data as SessionRow;
    const state = parseState(row.state);
    const students = state.students ?? [];
    const questions = state.questions ?? [];
    const fromTable = await listMatches(sessionId, { students, questions });
    const matches = fromTable.length > 0 ? fromTable : (state.matches ?? []);

    const session: Session = {
      sessionId: row.session_id,
      moduleName: row.module_name,
      dateCreated: dateCreatedDisplay(row, state),
      students,
      questions,
      matches,
      currentMatch: state.currentMatch ?? null,
    };
    if (typeof state.countdownSeconds === "number") session.countdownSeconds = state.countdownSeconds;
    if (typeof row.max_score === "number") session.maxScore = row.max_score;
    return session;
  } catch (err) {
    logSupabaseError("sessions.load threw", err, { sessionId });
    return null;
  }
}

export async function listSessions(): Promise<SessionSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("session_id, module_name, date_created, max_score, state");

  if (error) {
    logSupabaseError("sessions.list", error);
    return [];
  }
  if (!data) return [];

  const result = data.map((raw) => {
    const row = raw as SessionRow;
    return toSummary(row, parseState(row.state));
  });
  result.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return result;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const matchesResult = await deleteMatchesForSession(sessionId);
  if (!matchesResult.ok) return false;

  const supabase = createClient();
  const { data, error } = await supabase.from("sessions").delete().eq("session_id", sessionId).select("session_id");
  if (error) {
    logSupabaseError("sessions.delete", error, { sessionId });
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

export async function writeSessionBlob(session: Session): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.from("sessions").select("state").eq("session_id", session.sessionId).maybeSingle();
  const previousSavedAt = parseState(data?.state).savedAt ?? new Date().toISOString();
  const result = await persistSession(session, previousSavedAt);
  if (!result.ok) {
    console.error("[SmartQA] writeSessionBlob failed", result.error, { sessionId: session.sessionId });
  }
  return result.ok;
}

export function normalizeModuleKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function loadAllSessions(): Promise<Session[]> {
  const summaries = await listSessions();
  const sessions = await Promise.all(summaries.map((s) => loadSession(s.sessionId)));
  return sessions.filter((s): s is Session => s !== null);
}

export async function loadSessionsForModule(moduleName: string): Promise<Session[]> {
  const key = normalizeModuleKey(moduleName);
  if (!key) return [];
  const all = await loadAllSessions();
  return all.filter((s) => normalizeModuleKey(s.moduleName) === key);
}

export async function listSessionsByModule(moduleName: string): Promise<SessionSummary[]> {
  const key = normalizeModuleKey(moduleName);
  if (!key) return [];
  const all = await listSessions();
  return all.filter((s) => normalizeModuleKey(s.moduleName) === key);
}

export async function listModuleNames(): Promise<string[]> {
  const seen = new Map<string, string>();
  for (const session of await loadAllSessions()) {
    const key = normalizeModuleKey(session.moduleName);
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, session.moduleName.trim());
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
