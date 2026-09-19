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
  score?: number;       // 0 to session.maxScore, set at "Mark Complete"
};
```

### 3.4 Session

```ts
type Session = {
  sessionId: string;
  moduleName: string;
  dateCreated: string;
  maxScore?: number;    // set at session setup; if unset, scoring is disabled for this session
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
- Input: **Max score per session** (optional numeric field, e.g. blank by default). If left blank, scoring is disabled entirely for this session — no score picker appears at "Mark Complete," and no leaderboard appears on the summary screen. If set, this value becomes the upper bound for every score picker shown during this session (see §15.1).
- Upload Students file → preview → confirm
- Upload Questions file → preview → confirm
- "Start Session" button (disabled until both files are loaded and validated)
- Option: "Load previous session" (lists saved sessions from localStorage)
- "View Full Lists" link/button (see §5a — Roll Call / List Preview)

### Screen 1a — Roll Call / List Preview
Purpose: let the lecturer verify every expected student and question made it into the system correctly, and run a physical roll call before a session starts.

- Accessible from Screen 1 (after files are confirmed, before "Start Session") and from Screen 2 (mid-session, to check remaining vs. completed at a glance)
- Two tabs or side-by-side panels: **Students** and **Questions**
- **Students tab:** full table of `student_number | full_name | status` (pending/completed/skipped), sorted by student number by default. Include a search/filter box to jump to a specific student by name or number. A simple checkbox or visual tick next to each row lets the lecturer manually tick off physical attendance separately from the app's own pending/completed status — this is just a visual aid for the roll call, it does not affect matching logic.
- **Questions tab:** full table of `question_id | topic | question_text | status` (pending/used), with the same search/filter behavior.
- A **"Print list"** button that opens a clean, unstyled-for-print version of whichever tab is active — useful since roll call is a physical, in-room task and a printed sheet is often faster to check off than scrolling a screen.
- This screen is read-only with respect to session state — it must never let the lecturer edit statuses directly (that would bypass the randomizer's integrity). The manual attendance-tick checkboxes mentioned above are local UI state only, not persisted to the Session object.

### Screen 2 — Matching (main working screen)
- Header: Module name, date, live counters — `Students remaining: X / Total`, `Questions remaining: Y / Total`
- Big central button: **"Begin Match"**
  - On click: randomly select one `pending` student and one `pending` question (see §6 algorithm), display both prominently (student number, full name, topic, question text)
  - Button changes to disabled/hidden state; two action buttons appear:
    - **"Mark Complete"** — moves student → `completed`, question → `used`, logs to `matches[]`, clears `currentMatch`, re-enables "Begin Match"
    - **"Skip / Student Absent"** — returns both student and question to `pending` (no record logged, or logged separately as `skipped` if you want an absence audit trail — recommended), clears `currentMatch`, re-enables "Begin Match"
  - Optional: **"Reshuffle Question"** — keeps the same student, re-randomizes only the question (returns current question to pool first, excludes it from re-selection, picks a new one). Does not touch student status.
- Side panel: collapsible list of "Completed matches so far" (read-only, live-updating)
- "View Full Lists" link/button (see §5a) — for mid-session roll-call checks
- End-of-pool banners (see §7)

### Screen 3 — Session Summary / Export
- Reached automatically when a stopping condition is hit, or accessible any time via a "View Summary" link
- Table: Student | Question | Topic | Outcome | Time
- Buttons: **"Export CSV"**, **"Export PDF"**
- Button: **"Start New Session"** — navigates back to Screen 1 only. As of the Supabase migration (§18-19), this button must NOT delete the session's rows from the database — completed sessions are historical records now, not disposable local state. Deleting a session (if ever needed) is a separate, explicit action (e.g. a "Delete" control on the "Load previous session" list on Screen 1), never an implicit side effect of starting a new one.

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

## 12. v2 Features — Batch A: UI/UX Polish

These are additive, low-risk, and don't touch the core data model. Safe to build once v1 (through Screen 3 + roll call) is stable.

- **Keyboard shortcuts:** `Space` triggers "Begin Match" when idle; `Enter` triggers "Mark Complete" when a match is active. Shortcuts must be disabled while any text input (search box, upload, module name field) is focused, to avoid interfering with typing.
- **Match progress counter:** display "Match X of Y" (e.g. "Match 7 of 21", where Y = total students) prominently on Screen 2, updating live as matches complete. This also functions as a fairness/transparency signal for students watching.
- **Sound effects on reveal:** a short sound plays when a match is revealed (after the reveal animation from earlier settles). Includes:
  - A **volume slider** (0-100%), persisted via localStorage, so the lecturer can set it appropriately for the room.
  - A **sound picker** offering at least 3-4 distinct short sound options (e.g. "Chime," "Drumroll," "Ding," "Pop") that the lecturer can preview and select before or during a session, persisted via localStorage.
  - A **mute toggle** as a quick on/off separate from the volume slider, for silencing entirely without losing the saved volume level.
  - Source short, royalty-free sound clips (a few hundred KB each) rather than generating audio — bundle 3-4 options as static files in `/public/sounds/`.
- **Dark mode:** a toggle (sun/moon icon) that switches the whole app to a high-contrast dark theme, persisted via localStorage. Useful for dimmed lecture theatres and projector use.
- **Projector display mode:** a distinct visual mode (toggle from Screen 2) that enlarges fonts significantly and strips secondary UI (side panel, counters can move to a corner), optimized for being read from the back of a room.
- **Confetti/celebration on session completion:** a brief celebratory animation plays once when a stopping condition in §7 is reached (all students tested, or both pools exhausted). Should not play on the "questions exhausted, students remain" case, since that isn't a successful completion.

---

## 13. v2 Features — Batch B: Session Flow Enhancements

Build after Batch A is committed and tested.

- **Countdown timer per question:** once a match is revealed and settled, an optional visible countdown (default 2 minutes, configurable in session setup) starts automatically. On reaching zero, show a clear but non-disruptive visual/audio cue — do not auto-advance or auto-skip, since the lecturer must remain in control of that decision.
- **Pause/resume session:** a "Pause Session" button on Screen 2 that freezes the matching UI (disables "Begin Match") and shows a clear "Paused" banner. A "Resume" button un-freezes it. Session state is already preserved via localStorage regardless, so this is primarily a UI/UX affordance to prevent accidental clicks during a break, not a new persistence mechanism.
- **Bulk skip/exclude before starting:** on Screen 1 (or the roll call view, §5a), allow the lecturer to check off known-absent students before clicking "Start Session." Excluded students are set to `status: "skipped"` from the outset and never enter the random pool, rather than needing to be individually skipped mid-session.

---

## 14. v2 Features — Batch C: New Standalone Screens

Build after Batch B is committed and tested.

- **Public results view:** a read-only route (e.g. `/session/[id]/public`) showing only the list of completed matches (student name, question topic — omit full question text to avoid giving future students a study advantage) with no admin controls. Intended to be opened in a second browser tab/window/projector output so students can watch the live roll without crowding the lecturer's control screen.
- **Topic coverage dashboard:** a small panel/chart (bar or donut) on Screen 2 or the roll call view showing questions used vs. remaining per topic, so the lecturer can see topic balance at a glance during a session.

---

## 15. v2 Features — Batch D: Data Model Extensions

Build last, since these require extending the core types from §3. Back up (commit) before starting this batch — it's the riskiest set of changes to the existing app.

### 15.1 Scoring / leaderboard, bounded by session-level max score
- `Session.maxScore` (§3.4) is set once at session setup (Screen 1, §5) and applies to every match in that session. If left unset there, scoring is disabled entirely — no picker appears, no leaderboard appears.
- At the "Mark Complete" step, the score picker's range is dynamically bounded by `session.maxScore` — e.g. if the lecturer set max score to 20, the picker offers 0-20, not a fixed 1-5. Use a numeric stepper or slider rather than discrete stars once the range exceeds ~10, since a 20-star picker is unusable.
- `MatchRecord.score` (§3.3) stores the awarded value; it must never exceed the session's `maxScore` — validate this at input time, not just on display.
- Add a ranked results table to the Session Summary screen (§5, Screen 3), sortable by score, showing each score alongside the session's max (e.g. "14 / 20"), shown only if at least one score was recorded in that session.

### 15.2 Per-student cross-session history
- Requires querying across all saved sessions in localStorage (not just the current one) by `studentNumber`.
- From the roll call view (§5a) or summary screen, clicking a student's name shows every question they've been matched to across all past sessions for that module — primarily to help the lecturer avoid repeating the exact same question for the same student across resits or repeat sessions.

### 15.3 Historical stats across sessions
- A new top-level view (e.g. accessible from Screen 1) showing aggregate stats: total students tested across the term/module, most/least-used topics across all sessions, and total sessions run.
- Purely additive and read-only; must not modify any existing session data.

**Note on scope:** 15.2 and 15.3 depend on being able to reliably read all sessions for the *same module* out of localStorage, which today only stores sessions by individual session ID. Before building this batch, confirm with Cursor that `sessionStorage.ts` (§10) either already tags sessions by `moduleName` or needs a small addition to support filtering by module — this should be resolved as a first step within the batch, not assumed.

---

## 16. Mobile Responsiveness Requirements

The app must be fully usable on a phone or tablet, not just desktop — the lecturer may be walking around a classroom using a mobile device rather than sitting at a laptop.

- **Every screen** (Session Setup, Roll Call/List Preview, Matching, Summary, Public Results, and any v2 additions) must be reviewed and adjusted for mobile viewports (~375px-428px wide), not just checked at desktop width.
- **Tables** (student list, question list, match history, summary table) must not force horizontal scrolling as the primary way to read them on mobile — prefer a stacked/card layout on small screens (each row becomes a compact card) with the existing table layout retained for desktop/tablet widths, using Tailwind's responsive breakpoints (e.g. `hidden md:table` / `md:hidden` pairs, or an equivalent conditional layout).
- **The core "Begin Match" flow** (Screen 2) is the most important to get right on mobile, since it's the screen used live and repeatedly — buttons must be large enough to tap accurately (minimum ~44px touch target), text must remain legible without zooming, and the "Mark Complete"/"Skip" buttons must not require scrolling to reach after a match reveals.
- **File upload controls** must work with mobile file pickers (which may only offer access to Downloads/Files apps or cloud storage, not a full filesystem) — test actual file selection on a phone, not just assume the HTML file input works identically everywhere.
- **Modals/dialogs** (e.g. print preview, score picker, sound settings) must not overflow the viewport or get clipped on small screens.
- **Viewport meta tag**: confirm Next.js's default viewport configuration is present and not overridden in a way that disables pinch-zoom or breaks scaling (`width=device-width, initial-scale=1`).
- This is a cross-cutting review, not a new screen — it touches every existing component. Treat it as a dedicated pass done screen-by-screen, testing each one at actual mobile width (use browser dev tools' device toolbar, and ideally a real phone) before moving to the next.

---

## 17. Suggested First Prompt to Cursor

> Scaffold a Next.js 14 App Router project in TypeScript with Tailwind CSS. Implement the data types, file upload/parsing (xlsx + csv) with preview/validation, the matching screen with the "Begin Match / Mark Complete / Skip" flow, localStorage-based session persistence, and CSV export — following the attached PRD exactly, section by section, starting with the type definitions in `/types/index.ts` and the parsing utilities in `/lib` before building any UI screens.



---

# PART 2: Multi-User Platform (Admin + Student Portal)

This part is a distinct architectural phase from Part 1 (§1-17). Part 1 describes a single-user, client-only tool using localStorage. Everything below moves the app to a real backend (Supabase: Postgres database + authentication) with distinct Admin and Student roles. Build this only after Part 1 is stable, and build it in the phases listed in §18, not all at once.

## 18. Recommended Build Phases

1. **Supabase + database migration** — set up Supabase, define the schema (§19), migrate existing session/match persistence from localStorage to Supabase, with zero new user-facing features yet. The matching dashboard must work identically to before from the lecturer's point of view; only the storage layer changes underneath it.
2. **Admin authentication** — protect the matching dashboard behind an admin login. No public admin signup route.
3. **Student authentication** — Student ID + default password login, forced password change on first login.
4. **Student dashboard** — read-only view of the logged-in student's own match/score history.
5. **Admin "Reset Password" for students** (§21).
6. **Student-Learn content section** (§22).

Each phase should be its own set of Cursor prompts, tested and committed before starting the next. Do not combine authentication changes with unrelated feature changes in the same commit — if something breaks, you need to be able to isolate whether it was the auth logic or something else.

## 19. Database Schema (Supabase / Postgres)

```sql
-- Students
-- Passwords are NOT stored here — Supabase Auth's own auth.users table
-- handles them, via a deterministic synthetic email built from
-- student_number (see §20.2/20.3). student_number stays the primary key
-- (matches.student_number depends on it as a foreign key); auth_user_id
-- links to the actual Supabase Auth account once one exists for that student.
create table students (
  student_number text primary key,
  full_name text not null,
  auth_user_id uuid references auth.users(id),
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Admin profiles. Passwords are NOT stored here — Supabase Auth's own
-- auth.users table (protected, not directly queryable by the app) handles
-- password hashing and verification. This table just links an auth user
-- to admin-specific app data.
create table admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Sessions (mirrors the Session type from Part 1, §3.4, now server-side)
create table sessions (
  session_id uuid primary key default gen_random_uuid(),
  module_name text not null,
  date_created timestamptz not null default now(),
  max_score integer, -- null = scoring disabled for this session
  created_by uuid references admins(id)
);

-- Matches (mirrors MatchRecord from Part 1, §3.3, now with a real foreign key to students)
create table matches (
  match_id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(session_id) not null,
  student_number text references students(student_number) not null,
  question_id text not null,
  question_topic text not null,
  question_text text not null,
  outcome text not null check (outcome in ('completed', 'skipped')),
  score integer,
  matched_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Learning materials (for §22, Student-Learn section)
create table learning_materials (
  id uuid primary key default gen_random_uuid(),
  module_name text not null,
  topic text,
  material_type text not null check (material_type in ('note', 'link', 'file')),
  title text not null,
  content_or_url text not null,
  created_at timestamptz not null default now()
);

-- Audit trail for admin-triggered student password resets (§21)
create table password_resets (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references admins(id) not null,
  student_number text references students(student_number) not null,
  reset_at timestamptz not null default now()
);
```

**Row-Level Security (RLS) is mandatory, not optional**, before any student-facing route goes live:
- `students`: a logged-in student may only read their own row (match on `student_number` from their auth session).
- `matches`: a logged-in student may only read rows where `student_number` matches their own — this is the single most important policy in the whole system, since it's what stops one student from seeing another's scores.
- `sessions`, `learning_materials`: readable by any authenticated student (they need to see session context and course materials); writable only by admins.
- `admins`: no student-facing access at all.

## 20. Authentication Flows

### 20.1 Password storage
- Passwords are **never** stored or compared in plain text, including the shared default password. Hash with bcrypt (or Supabase Auth's built-in handling, see below) before storing.
- The literal string of the default password must not appear hardcoded in application source files committed to the repo — store it as an environment variable (e.g. `DEFAULT_STUDENT_PASSWORD`) used only by the account-creation/seed script, never referenced elsewhere.

### 20.2 Implementation approach
**Decided: Option A — Supabase Auth with synthetic emails.** Each student maps to a deterministic synthetic email, `{student_number}@smartqa.internal` (never shown to the student, who only ever types their Student Number). Because the mapping is deterministic, the app builds this email directly from what the student types at login — no database lookup is needed before authenticating, which also means the `students` table never needs to grant public/anonymous read access just to support login.

**Bulk account creation.** Unlike the single admin account (created once, by hand, in §20.4), student accounts must be created in bulk whenever a roster is uploaded — this cannot be a manual per-student process. Creating a Supabase Auth user requires the **service role key** (admin-level access, bypasses RLS), which must only ever run **server-side** (a Next.js API route), never in client-side code — see §23. Design:
- When a student roster is uploaded (the existing CSV upload flow from Part 1), the app calls a server-side route that, for each student_number not yet linked to an `auth_user_id`: creates a Supabase Auth user with the synthetic email and the default password (from the `DEFAULT_STUDENT_PASSWORD` env var, §20.1), then updates that student's row with the new `auth_user_id` and `must_change_password = true`.
- This route must be idempotent — re-uploading a roster that includes already-registered students must skip creating duplicate auth accounts for them, only creating accounts for genuinely new student_numbers.
- Also provide a manual "Sync accounts" action in the admin dashboard, to backfill auth accounts for any student rows that predate this feature (e.g. rows already in the table from earlier testing) without needing a full re-upload.

### 20.3 Student login flow
1. Student enters their Student Number and their current password (default `Mis@26` on first login, via `DEFAULT_STUDENT_PASSWORD` env var — see §20.1).
2. The app constructs the synthetic email (`{student_number}@smartqa.internal`) client-side and calls Supabase Auth's sign-in method with it and the entered password — no database lookup required first.
3. On successful login, check that student's `must_change_password` flag (queried from `students`, restricted by RLS to their own row — see §19). If true, force a "Create your new password" screen before allowing access to anything else — no skipping this step.
4. On successful password change (via Supabase Auth's update-password method), set `must_change_password` to false and proceed to the student dashboard.
5. If sign-in fails because no auth account exists yet for that student_number (e.g. their roster row hasn't been synced), show a clear message directing them to contact the lecturer/admin, rather than a generic "invalid credentials" error — this is a genuinely different problem from a wrong password.

### 20.4 Admin login flow
- No public signup route in the app. The first admin account is created directly in the Supabase dashboard or via a one-time seed script run locally (not exposed as a web endpoint).
- The app provides: Admin Login screen, and a "Change Password" option inside the admin dashboard (using Supabase Auth's own password-update API), for ongoing use after the initial manual setup.
- Same `must_change_password` forced-change pattern as students, if the initial admin account is seeded with a known default password.

## 21. Admin "Reset Password" (for students)

- Accessible from the admin dashboard: an input for **Student Number**, a "Proceed Reset" button.
- On submit: look up the student, display their full name and Student Number for confirmation ("Are you sure you want to reset the password for [Name], [Student Number]?").
- On confirmation: this must go through a server-side route using the **service role key** (same pattern as the bulk account sync in §20.2) — since passwords are managed by Supabase Auth, not a `password_hash` column, resetting means calling Supabase Auth's admin API to set that student's auth account password back to the default (`DEFAULT_STUDENT_PASSWORD`), then setting `must_change_password` back to true on their `students` row.
- This route must itself verify the caller is an authenticated admin, same as the sync-accounts route — it must never be callable by a student or an anonymous request.
- Show a clear success message once done ("Password reset. [Name] will be prompted to set a new password on next login.").
- This action must be logged for accountability — insert a row into the `password_resets` audit table (admin_id, student_number, reset_at) on every reset, without exception.

## 22. Student-Learn Section

- **Study materials view:** students see a list of materials (notes, links, files) tagged by module/topic, populated by admins via a simple admin-side content management view (add/edit/delete entries in `learning_materials`).
- **Check Progression view:** shows the logged-in student's own match history — which questions they've answered, in which sessions, and their scores (if scoring was enabled for that session) — pulled from the `matches` table filtered to their own `student_number`. Present this as a simple timeline or table, plus a summary stat block (total questions answered, average score if applicable, topics covered so far).
- Both views are read-only for students — they cannot edit materials or their own match history.

## 23. Security Notes (read before building Part 2)

- Treat this section as a checklist to revisit at the end of each phase in §18, not just once.
- Never trust client-side checks alone for access control — RLS policies (§19) are the real enforcement layer; UI restrictions are just convenience.
- Rate-limit login attempts if Supabase's defaults don't already cover it, to reduce brute-force risk against the shared default password pattern.
- Store Supabase URL/keys as environment variables in Vercel's project settings, never committed to the repo.
- Use the Supabase **anon key** (restricted by RLS) in client-side code; never expose the **service role key** (which bypasses RLS) to the browser — it should only ever be used server-side (e.g. in a Next.js API route) for admin operations like the password reset flow.
- **Never let a "Saved" or success indicator show a positive state before the write is confirmed.** A UI that optimistically shows "Saved" and only updates on the *next* mutation (rather than on the actual response of the current one) can mask a real failure indefinitely — this happened once already during the Phase 1 migration and cost real debugging time to trace. Every Supabase write's success/failure state must reflect that specific write's actual result.
- **Never swallow a Supabase error into a generic return value without logging the full error object** (`message`, `code`, `details`, `hint`, `status`). A try/catch that converts a real database error into `{ ok: false }` with no logged detail makes failures nearly undiagnosable later — log the full object to the console at minimum, and surface a visible error state to the user for any write that fails.

## 24. Further Feature Suggestions (session effectiveness & student-friendliness)

- **Pre-session announcements:** admin can post a short note ("Bring your notes for Topic 3-5") visible to students before a session, via the Student-Learn section.
- **Post-answer feedback:** optionally let the admin attach a short written comment to a match at "Mark Complete," visible to that student on their dashboard — turns the tool into light formative feedback, not just a pass/fail record.
- **Topic self-check:** before a session, students could see which topics are in scope (without seeing the actual question bank) so they know what to revise.
- **Anonymized cohort comparison:** on the student dashboard, show how their average score compares to the module's average, without naming other students — motivating without being a public leaderboard.
- **Downloadable personal transcript:** a student can export their own match/score history as a PDF — useful for their own revision records or portfolio.
- **Email/notification on reset:** if you later add real student emails, notify them when their password is reset by an admin, as a security best practice (so a student is aware if it happens unexpectedly).
