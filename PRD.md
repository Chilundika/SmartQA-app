# Product Requirements Document: Random Student–Question Matcher

**For:** Cursor (AI coding assistant) project brief
**Deploy target:** Vercel
**Author:** Lecturer/Examiner tool for oral exams, vivas, or in-class random questioning

---

## 1. Overview

A web app that lets a lecturer/examiner:

1. Upload a list of students (number + name).
2. Upload a bank of exam/practice questions (topic + text).
3. Randomly pair one unused student with one unused question, one pairing at a time, at the click of a button.
4. Mark each pairing as "Completed" (or "Skip" if the student is absent), which removes both the student and question from the available pool.
5. Continue until either pool is exhausted, with clear end-of-session messaging.
6. Export a record of all completed matches (CSV/PDF) for moderation/record-keeping.

This is a **single-user (lecturer) tool per session** — no student-facing UI, no login system required for v1.

---

## 2. Tech Stack

- **Framework:** Next.js 14+ (App Router), TypeScript
- **Styling:** Tailwind CSS
- **File parsing:** `xlsx` (SheetJS) for `.xlsx`, `papaparse` for `.csv`
- **State/persistence (v1):** Browser `localStorage` via a small wrapper — no backend database needed
- **State/persistence (v2, optional):** Vercel Postgres or SQLite via Prisma, if the lecturer wants sessions to persist across devices or wants multi-module history stored server-side
- **Deployment:** Vercel (zero-config for Next.js; `vercel.json` not required unless customizing)
- **Export:** `papaparse`/native CSV generation for CSV export; `jspdf` or `@react-pdf/renderer` for optional PDF export

No authentication is required for v1 since it's a single-lecturer local tool. If shared across multiple examiners later, add a simple passcode gate or NextAuth.

---

## 3. Data Model

### 3.1 Student

```ts
type Student = {
  id: string;            // generated UUID, internal use
  studentNumber: string; // from upload, must be unique
  fullName: string;
  status: "pending" | "completed" | "skipped";
};
```

### 3.2 Question

```ts
type Question = {
  id: string;            // generated UUID, internal use
  questionId: string;    // from upload (e.g. "Q1"), must be unique
  topic: string;
  questionText: string;
  status: "pending" | "used";
};
```

### 3.3 Match record

```ts
type MatchRecord = {
  matchId: string;
  student: Student;
  question: Question;
  matchedAt: string;   // ISO timestamp
  completedAt?: string;
  outcome: "completed" | "skipped";
};
```

### 3.4 Session

```ts
type Session = {
  sessionId: string;
  moduleName: string;
  dateCreated: string;
  students: Student[];
  questions: Question[];
  matches: MatchRecord[];
  currentMatch?: { student: Student; question: Question } | null;
};
```

Sessions are stored as a single JSON blob in `localStorage` under a key like `rsm_session_<sessionId>`, plus an index of session IDs/names for the "load previous session" screen.

---

## 4. Required File Formats

### Students file (`.xlsx` or `.csv`)

| student_number | full_name |
|---|---|
| 2021045678 | Jane Mwansa |
| 2021045679 | Peter Banda |

- Headers must match exactly (case-insensitive matching is fine, but flag on mismatch).
- `student_number` must be unique — reject upload with a specific error row list if duplicates are found.
- Blank rows should be silently skipped; rows missing either field should be flagged and excluded, with a summary shown to the lecturer ("3 rows skipped due to missing data — see details").

### Questions file (`.xlsx` or `.csv`)

| question_id | topic | question_text |
|---|---|---|
| Q1 | Data Structures | Explain the difference between a stack and a queue. |
| Q2 | Networking | Describe how DNS resolution works. |

- `question_id` must be unique.
- `question_text` should be a single cell, no embedded line breaks (warn if detected, since it can break CSV parsing).
- Extra columns (e.g. `marks`, `difficulty`) should be preserved and displayed but are not required — the app should not fail if they're present or absent.

### Validation UX

On upload, show a preview table of parsed rows before committing, with:
- Row count successfully parsed
- Any rejected/skipped rows and why
- A "Confirm & Load" button, so the lecturer isn't surprised by bad data mid-session

---

## 5. Core Screens & Flow

### Screen 1 — Session Setup
- Input: Module name, date (auto-filled, editable)
- Upload Students file → preview → confirm
- Upload Questions file → preview → confirm
- "Start Session" button (disabled until both files are loaded and validated)
- Option: "Load previous session" (lists saved sessions from localStorage)

### Screen 2 — Matching (main working screen)
- Header: Module name, date, live counters — `Students remaining: X / Total`, `Questions remaining: Y / Total`
- Big central button: **"Begin Match"**
  - On click: randomly select one `pending` student and one `pending` question (see §6 algorithm), display both prominently (student number, full name, topic, question text)
  - Button changes to disabled/hidden state; two action buttons appear:
    - **"Mark Complete"** — moves student → `completed`, question → `used`, logs to `matches[]`, clears `currentMatch`, re-enables "Begin Match"
    - **"Skip / Student Absent"** — returns both student and question to `pending` (no record logged, or logged separately as `skipped` if you want an absence audit trail — recommended), clears `currentMatch`, re-enables "Begin Match"
  - Optional: **"Reshuffle Question"** — keeps the same student, re-randomizes only the question (returns current question to pool first, excludes it from re-selection, picks a new one). Does not touch student status.
- Side panel: collapsible list of "Completed matches so far" (read-only, live-updating)
- End-of-pool banners (see §7)

### Screen 3 — Session Summary / Export
- Reached automatically when a stopping condition is hit, or accessible any time via a "View Summary" link
- Table: Student | Question | Topic | Outcome | Time
- Buttons: **"Export CSV"**, **"Export PDF"**
- Button: **"Start New Session"** (clears current session state, returns to Screen 1)

---

## 6. Randomization Algorithm

Keep it simple and auditable — no need for anything fancier than:

```ts
function pickRandom<T>(pool: T[]): T {
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function beginMatch(session: Session) {
  const pendingStudents = session.students.filter(s => s.status === "pending");
  const pendingQuestions = session.questions.filter(q => q.status === "pending");

  if (pendingStudents.length === 0) return { status: "ALL_STUDENTS_DONE" };
  if (pendingQuestions.length === 0) return { status: "ALL_QUESTIONS_EXHAUSTED" };

  const student = pickRandom(pendingStudents);
  const question = pickRandom(pendingQuestions);
  return { status: "MATCHED", student, question };
}
```

Use `crypto.getRandomValues` instead of `Math.random()` if you want to be able to say the randomization is cryptographically fair (nice for defensibility if a student ever questions the process) — otherwise `Math.random()` is fine for this use case.

**Optional v2 enhancement — topic spacing:** to avoid the same topic coming up twice in a row by chance, weight selection to deprioritize (not exclude) the topic of the immediately preceding match. Don't build this in v1; it adds complexity for a cosmetic benefit.

---

## 7. Stopping Conditions & Messaging

| Condition | System behavior |
|---|---|
| Students pool empty, questions remain | Disable "Begin Match". Show: *"All students have been tested. Session complete."* Remaining questions stay visible/read-only for reference. Auto-suggest viewing summary. |
| Questions pool empty, students remain | Disable "Begin Match". Show: *"All questions have been exhausted. Please add more questions to continue."* Provide an inline "Upload more questions" control that merges new questions into the existing pool (validate for duplicate `question_id` against existing ones) without resetting progress. |
| Both pools empty simultaneously | Show: *"Session complete — all students matched and all questions used."* |
| Mid-session file re-upload attempted (students) | Warn that this will not affect already-completed matches but will merge new students into the pending pool; require confirmation. |

---

## 8. Additional Recommended Features (v1 nice-to-haves)

- **Absence/skip audit trail:** log skipped attempts separately so the lecturer has a record of who didn't respond when called, distinct from "completed."
- **Manual "undo last match":** in case of a misclick on "Mark Complete," a single-level undo restores the last student/question to pending and removes the record.
- **Session autosave indicator:** small "Saved" indicator confirming localStorage writes succeeded, since there's no backend to fall back on.
- **Print-friendly summary view:** a clean, unstyled-for-print version of the summary table for physical moderation records.
- **Keyboard shortcuts:** e.g. `Space` = Begin Match, `Enter` = Mark Complete — speeds up live classroom use.
- **Dark/high-contrast mode:** useful if this is projected in a lecture theatre.

## 9. Features to Explicitly Defer (out of scope for v1)

- Multi-examiner accounts / login system
- Student-facing views or notifications
- Automatic topic-balancing algorithm
- Real-time collaboration (multiple lecturers running the same session simultaneously)
- Mobile app version (a responsive web layout is sufficient)

---

## 10. Suggested Project Structure (for Cursor to scaffold)

```
/app
  /page.tsx                 -> Screen 1: Session setup
  /session/[id]/page.tsx    -> Screen 2: Matching
  /session/[id]/summary/page.tsx -> Screen 3: Summary/export
/components
  FileUploader.tsx
  StudentPreviewTable.tsx
  QuestionPreviewTable.tsx
  MatchCard.tsx
  SessionCounters.tsx
  MatchHistoryList.tsx
  ExportButtons.tsx
/lib
  parseStudents.ts
  parseQuestions.ts
  randomizer.ts
  sessionStorage.ts   (localStorage read/write wrapper)
  exportCsv.ts
  exportPdf.ts
/types
  index.ts   (Student, Question, MatchRecord, Session types from §3)
```

---

## 11. Deployment Notes (Vercel)

- Next.js deploys to Vercel with zero config — just connect the GitHub repo and Vercel auto-detects the framework.
- Since v1 uses only `localStorage`, there's no environment variables or database setup needed.
- If upgrading to v2 with Vercel Postgres: add `@vercel/postgres` or Prisma, set `DATABASE_URL` in Vercel's project environment variables, and run migrations via a Vercel build step.
- Recommend enabling Vercel's preview deployments so you can test each Cursor-generated change on a shareable URL before merging to production.

---

## 12. Suggested First Prompt to Cursor

> Scaffold a Next.js 14 App Router project in TypeScript with Tailwind CSS. Implement the data types, file upload/parsing (xlsx + csv) with preview/validation, the matching screen with the "Begin Match / Mark Complete / Skip" flow, localStorage-based session persistence, and CSV export — following the attached PRD exactly, section by section, starting with the type definitions in `/types/index.ts` and the parsing utilities in `/lib` before building any UI screens.

