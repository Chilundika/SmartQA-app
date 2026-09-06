import type { Question, Session, Student } from "../types/index.ts";

export type BeginMatchResult =
  | { status: "ALL_STUDENTS_DONE" }
  | { status: "ALL_QUESTIONS_EXHAUSTED" }
  | { status: "MATCHED"; student: Student; question: Question };

export function pickRandom<T>(pool: T[]): T {
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

export function beginMatch(session: Session): BeginMatchResult {
  const pendingStudents = session.students.filter((s) => s.status === "pending");
  const pendingQuestions = session.questions.filter((q) => q.status === "pending");

  if (pendingStudents.length === 0) return { status: "ALL_STUDENTS_DONE" };
  if (pendingQuestions.length === 0) return { status: "ALL_QUESTIONS_EXHAUSTED" };

  const student = pickRandom(pendingStudents);
  const question = pickRandom(pendingQuestions);
  return { status: "MATCHED", student, question };
}
