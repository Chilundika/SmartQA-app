import Papa from "papaparse";
import type { MatchRecord, Session } from "../types/index.ts";

export const SUMMARY_CSV_COLUMNS = ["Student", "Question", "Topic", "Outcome", "Time"] as const;

export type SummaryCsvRow = {
  Student: string;
  Question: string;
  Topic: string;
  Outcome: string;
  Time: string;
};

export function formatMatchTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function matchToSummaryRow(match: MatchRecord): SummaryCsvRow {
  return {
    Student: `${match.student.studentNumber} ${match.student.fullName}`.trim(),
    Question: `${match.question.questionId} ${match.question.questionText}`.trim(),
    Topic: match.question.topic,
    Outcome: match.outcome === "completed" ? "Completed" : "Skipped",
    Time: formatMatchTime(match.completedAt ?? match.matchedAt),
  };
}

export function sessionToSummaryRows(session: Session): SummaryCsvRow[] {
  return session.matches.map(matchToSummaryRow);
}

export function buildSummaryCsv(session: Session): string {
  return Papa.unparse(sessionToSummaryRows(session), {
    columns: [...SUMMARY_CSV_COLUMNS],
  });
}

function safeFilenamePart(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ").trim().replace(/\s+/g, "-");
  return cleaned.slice(0, 60) || "session";
}

export function summaryCsvFilename(session: Session): string {
  return `${safeFilenamePart(session.moduleName)}-${safeFilenamePart(session.dateCreated)}.csv`;
}

/** Triggers a CSV download in the browser. No-op during SSR. */
export function downloadSessionCsv(session: Session): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([buildSummaryCsv(session)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = summaryCsvFilename(session);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
