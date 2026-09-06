export type Student = {
  id: string;            // generated UUID, internal use
  studentNumber: string; // from upload, must be unique
  fullName: string;
  status: "pending" | "completed" | "skipped";
};

export type Question = {
  id: string;            // generated UUID, internal use
  questionId: string;    // from upload (e.g. "Q1"), must be unique
  topic: string;
  questionText: string;
  status: "pending" | "used";
};

export type MatchRecord = {
  matchId: string;
  student: Student;
  question: Question;
  matchedAt: string;   // ISO timestamp
  completedAt?: string;
  outcome: "completed" | "skipped";
};

export type Session = {
  sessionId: string;
  moduleName: string;
  dateCreated: string;
  students: Student[];
  questions: Question[];
  matches: MatchRecord[];
  currentMatch?: { student: Student; question: Question } | null;
};
