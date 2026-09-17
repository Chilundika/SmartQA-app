import type { MatchRecord, Question, Student } from "../../types/index.ts";
import { createClient } from "../supabase/client.ts";
import { formatDbError, logSupabaseError } from "./errors.ts";

export type MatchRow = {
  match_id: string;
  session_id: string;
  student_number: string;
  question_id: string;
  question_topic: string;
  question_text: string;
  outcome: "completed" | "skipped";
  score: number | null;
  matched_at: string;
  completed_at: string | null;
};

function isOutcome(value: string): value is "completed" | "skipped" {
  return value === "completed" || value === "skipped";
}

function toMatchRow(sessionId: string, match: MatchRecord): Omit<MatchRow, "session_id"> & { session_id: string } {
  return {
    match_id: match.matchId,
    session_id: sessionId,
    student_number: match.student.studentNumber,
    question_id: match.question.questionId,
    question_topic: match.question.topic,
    question_text: match.question.questionText,
    outcome: match.outcome,
    score: typeof match.score === "number" ? match.score : null,
    matched_at: match.matchedAt,
    completed_at: match.completedAt ?? null,
  };
}

function reconstructMatch(row: MatchRow, students: Student[], questions: Question[]): MatchRecord {
  const completed = row.outcome === "completed";
  const student = students.find((s) => s.studentNumber === row.student_number);
  const question = questions.find((q) => q.questionId === row.question_id);
  return {
    matchId: row.match_id,
    student: student
      ? { ...student, status: completed ? "completed" : "pending" }
      : {
          id: row.student_number,
          studentNumber: row.student_number,
          fullName: row.student_number,
          status: completed ? "completed" : "pending",
        },
    question: question
      ? { ...question, status: completed ? "used" : "pending" }
      : {
          id: row.question_id,
          questionId: row.question_id,
          topic: row.question_topic,
          questionText: row.question_text,
          status: completed ? "used" : "pending",
        },
    matchedAt: row.matched_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    outcome: isOutcome(row.outcome) ? row.outcome : "completed",
    ...(row.score == null ? {} : { score: row.score }),
  };
}

export async function ensureStudents(students: Student[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = students
    .map((s) => ({
      student_number: s.studentNumber.trim(),
      full_name: s.fullName.trim() || s.studentNumber.trim(),
      must_change_password: true,
    }))
    .filter((s) => s.student_number);

  if (rows.length === 0) return { ok: true };

  const unique = [...new Map(rows.map((r) => [r.student_number, r])).values()];
  const supabase = createClient();
  const { error } = await supabase.from("students").upsert(unique, {
    onConflict: "student_number",
    ignoreDuplicates: true,
  });

  if (error) {
    logSupabaseError("students.upsert", error, { count: unique.length });
    return { ok: false, error: formatDbError("Could not save students:", error) };
  }
  return { ok: true };
}

/** Inserts or updates one match row. The session row must already exist (FK). */
export async function saveMatch(
  sessionId: string,
  match: MatchRecord,
): Promise<{ ok: true; savedAt: string } | { ok: false; error: string }> {
  const ensured = await ensureStudents([match.student]);
  if (!ensured.ok) return ensured;

  const supabase = createClient();
  const savedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("matches")
    .upsert(toMatchRow(sessionId, match), { onConflict: "match_id" })
    .select("match_id")
    .maybeSingle();
  if (error) {
    logSupabaseError("matches.upsert", error, { sessionId, matchId: match.matchId });
    return { ok: false, error: formatDbError("Could not save match:", error) };
  }
  if (!data?.match_id) {
    console.error("[SmartQA] matches.upsert returned no row", { sessionId, matchId: match.matchId });
    return {
      ok: false,
      error:
        "Could not save match: the database accepted the request but did not return a matches row. Check RLS policies on public.matches.",
    };
  }
  return { ok: true, savedAt };
}

export async function listMatches(
  sessionId: string,
  pools: { students: Student[]; questions: Question[] } = { students: [], questions: [] },
): Promise<MatchRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      "match_id, session_id, student_number, question_id, question_topic, question_text, outcome, score, matched_at, completed_at",
    )
    .eq("session_id", sessionId)
    .order("matched_at", { ascending: true })
    .order("match_id", { ascending: true });

  if (error) {
    logSupabaseError("matches.select", error, { sessionId });
    return [];
  }
  if (!data) return [];
  return data.map((row) => reconstructMatch(row as MatchRow, pools.students, pools.questions));
}

export async function replaceSessionMatches(
  sessionId: string,
  matches: MatchRecord[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ensured = await ensureStudents(matches.map((m) => m.student));
  if (!ensured.ok) return ensured;

  const supabase = createClient();
  const { error: deleteError } = await supabase.from("matches").delete().eq("session_id", sessionId);
  if (deleteError) {
    logSupabaseError("matches.delete", deleteError, { sessionId });
    return { ok: false, error: formatDbError("Could not save matches:", deleteError) };
  }

  if (matches.length === 0) return { ok: true };

  const { data, error: insertError } = await supabase
    .from("matches")
    .insert(matches.map((match) => toMatchRow(sessionId, match)))
    .select("match_id");
  if (insertError) {
    logSupabaseError("matches.insert", insertError, { sessionId, count: matches.length });
    return { ok: false, error: formatDbError("Could not save matches:", insertError) };
  }
  if (!data || data.length !== matches.length) {
    console.error("[SmartQA] matches.insert returned unexpected row count", {
      sessionId,
      expected: matches.length,
      returned: data?.length ?? 0,
    });
    return {
      ok: false,
      error:
        "Could not save matches: the database accepted the request but did not return every matches row. Check RLS policies on public.matches.",
    };
  }
  return { ok: true };
}

export async function deleteMatchesForSession(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("matches").delete().eq("session_id", sessionId);
  if (error) {
    logSupabaseError("matches.deleteForSession", error, { sessionId });
    return { ok: false, error: formatDbError("Could not delete matches:", error) };
  }
  return { ok: true };
}
