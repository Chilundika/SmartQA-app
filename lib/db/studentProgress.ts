import { MAX_SCORE_CAP } from "../score.ts";
import { createClient } from "../supabase/client.ts";
import { formatDbError, logSupabaseError } from "./errors.ts";

export type StudentProgressMatch = {
  matchId: string;
  matchedAt: string;
  moduleName: string;
  sessionDate: string;
  topic: string;
  outcome: "completed" | "skipped";
  scoreLabel: string | null;
  score: number | null;
  maxScore: number | null;
};

export type StudentProgressSummary = {
  answeredCount: number;
  averageLabel: string | null;
  topics: string[];
};

export type StudentProgress = {
  matches: StudentProgressMatch[];
  summary: StudentProgressSummary;
};

function maxScoreFromValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 1) return null;
  return Math.min(MAX_SCORE_CAP, n);
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatAverage(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function scoreLabel(score: unknown, maxScore: number | null): string | null {
  if (maxScore == null) return null;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return `${score} / ${maxScore}`;
}

function buildSummary(matches: StudentProgressMatch[]): StudentProgressSummary {
  const answered = matches.filter((m) => m.outcome === "completed");
  const scored = matches.filter((m) => m.score != null && m.maxScore != null) as Array<
    StudentProgressMatch & { score: number; maxScore: number }
  >;

  let averageLabel: string | null = null;
  if (scored.length > 0) {
    const sameMax = scored.every((m) => m.maxScore === scored[0].maxScore);
    if (sameMax) {
      const avg = scored.reduce((sum, m) => sum + m.score, 0) / scored.length;
      averageLabel = `${formatAverage(avg)} / ${scored[0].maxScore}`;
    } else {
      const avgPct =
        (scored.reduce((sum, m) => sum + m.score / m.maxScore, 0) / scored.length) * 100;
      averageLabel = `${formatAverage(avgPct)}%`;
    }
  }

  const topics = [...new Set(answered.map((m) => m.topic).filter((topic) => topic.trim()))];
  topics.sort((a, b) => a.localeCompare(b));

  return {
    answeredCount: answered.length,
    averageLabel,
    topics,
  };
}

/**
 * Loads the signed-in student's matches via RLS.
 * Do not filter by student_number here — a client filter would hide an RLS failure.
 */
export async function loadStudentProgress(): Promise<
  { ok: true; progress: StudentProgress } | { ok: false; error: string }
> {
  const supabase = createClient();
  const { data: matchRows, error: matchError } = await supabase
    .from("matches")
    .select("match_id, session_id, question_topic, outcome, score, matched_at")
    .order("matched_at", { ascending: false })
    .order("match_id", { ascending: false });

  if (matchError) {
    logSupabaseError("student.progress matches.select", matchError);
    return { ok: false, error: formatDbError("Could not load your match history:", matchError) };
  }

  const rows = matchRows ?? [];
  if (rows.length === 0) {
    return { ok: true, progress: { matches: [], summary: { answeredCount: 0, averageLabel: null, topics: [] } } };
  }

  const sessionIds = [...new Set(rows.map((row) => String(row.session_id ?? "")).filter(Boolean))];
  const { data: sessionRows, error: sessionError } = await supabase
    .from("sessions")
    .select("session_id, module_name, date_created, max_score")
    .in("session_id", sessionIds);

  if (sessionError) {
    logSupabaseError("student.progress sessions.select", sessionError, { count: sessionIds.length });
    return { ok: false, error: formatDbError("Could not load session details:", sessionError) };
  }

  const sessions = new Map(
    (sessionRows ?? []).map((row) => [
      String(row.session_id),
      {
        moduleName: String(row.module_name ?? "Unknown module"),
        sessionDate: formatSessionDate(String(row.date_created ?? "")),
        maxScore: maxScoreFromValue(row.max_score),
      },
    ]),
  );

  const matches: StudentProgressMatch[] = rows.map((row) => {
    const session = sessions.get(String(row.session_id));
    const outcome = row.outcome === "skipped" ? "skipped" : "completed";
    const maxScore = session?.maxScore ?? null;
    const score = typeof row.score === "number" && Number.isFinite(row.score) ? row.score : null;
    return {
      matchId: String(row.match_id),
      matchedAt: String(row.matched_at ?? ""),
      moduleName: session?.moduleName ?? "Unknown module",
      sessionDate: session?.sessionDate ?? "",
      topic: String(row.question_topic ?? "").trim() || "Untitled topic",
      outcome,
      scoreLabel: scoreLabel(score, maxScore),
      score,
      maxScore,
    };
  });

  return { ok: true, progress: { matches, summary: buildSummary(matches) } };
}
