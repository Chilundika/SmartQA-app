// Standalone check for the randomizer. Run from the project root with:
//   node lib/randomizer.test.ts
// (Node 22.6+ strips types natively; no test runner needed.)

import type { Question, Session, Student } from "../types/index.ts";
import { beginMatch } from "./randomizer.ts";

const students: Student[] = [
  { id: "s-1", studentNumber: "2021045678", fullName: "Jane Mwansa", status: "pending" },
  { id: "s-2", studentNumber: "2021045679", fullName: "Peter Banda", status: "pending" },
  { id: "s-3", studentNumber: "2021045680", fullName: "Chipo Phiri", status: "pending" },
];

const questions: Question[] = [
  {
    id: "q-1",
    questionId: "Q1",
    topic: "Data Structures",
    questionText: "Explain the difference between a stack and a queue.",
    status: "pending",
  },
  {
    id: "q-2",
    questionId: "Q2",
    topic: "Networking",
    questionText: "Describe how DNS resolution works.",
    status: "pending",
  },
  {
    id: "q-3",
    questionId: "Q3",
    topic: "Databases",
    questionText: "Explain the purpose of database normalization.",
    status: "pending",
  },
];

const session: Session = {
  sessionId: "test-session",
  moduleName: "Test Module",
  dateCreated: new Date().toISOString(),
  students,
  questions,
  matches: [],
  currentMatch: null,
};

const seenStudents = new Set<string>();
const seenQuestions = new Set<string>();

for (let round = 1; round <= 3; round++) {
  const result = beginMatch(session);
  console.log(`\nRound ${round}:`, result.status);

  if (result.status !== "MATCHED") break;

  const { student, question } = result;
  console.log(`  Student : ${student.studentNumber} - ${student.fullName}`);
  console.log(`  Question: ${question.questionId} [${question.topic}] ${question.questionText}`);

  if (seenStudents.has(student.id)) console.error("  !! REPEATED STUDENT");
  if (seenQuestions.has(question.id)) console.error("  !! REPEATED QUESTION");
  seenStudents.add(student.id);
  seenQuestions.add(question.id);

  // beginMatch is pure and does not touch status; "Mark Complete" (PRD §5)
  // is what removes the pair from the pools, so simulate it here.
  student.status = "completed";
  question.status = "used";
}

console.log("\nAfter 3 rounds, beginMatch returns:", beginMatch(session).status);

const ok = seenStudents.size === 3 && seenQuestions.size === 3;
console.log(ok ? "\nPASS: 3 distinct students and 3 distinct questions matched." : "\nFAIL: repeats detected.");
process.exitCode = ok ? 0 : 1;
