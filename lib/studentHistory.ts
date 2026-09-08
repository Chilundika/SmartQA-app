import { loadSessionsForModule } from "./sessionStorage.ts";

export type StudentHistoryEntry = {
  sessionId: string;
  dateCreated: string;
  questionId: string;
  questionText: string;
  topic: string;
  outcome: "completed" | "skipped";
  matchedAt: string;
};

function normalizeStudentNumber(value: string): string {
  return value.trim().toLowerCase();
}

/** Read-only lookup of every match for this student number in the same module. */
export function studentHistoryForModule(moduleName: string, studentNumber: string): StudentHistoryEntry[] {
  const want = normalizeStudentNumber(studentNumber);
  if (!want) return [];
  const entries: StudentHistoryEntry[] = [];
  for (const session of loadSessionsForModule(moduleName)) {
    for (const match of session.matches) {
      if (normalizeStudentNumber(match.student.studentNumber) !== want) continue;
      entries.push({
        sessionId: session.sessionId,
        dateCreated: session.dateCreated,
        questionId: match.question.questionId,
        questionText: match.question.questionText,
        topic: match.question.topic,
        outcome: match.outcome,
        matchedAt: match.matchedAt,
      });
    }
  }
  entries.sort((a, b) => b.matchedAt.localeCompare(a.matchedAt));
  return entries;
}
