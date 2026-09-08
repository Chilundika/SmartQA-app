"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import AddQuestionsPanel from "./AddQuestionsPanel";
import AddStudentsPanel from "./AddStudentsPanel";
import ConfettiBurst from "./ConfettiBurst";
import MatchCard, { type RevealMode } from "./MatchCard";
import MatchHistoryList from "./MatchHistoryList";
import ProjectorToggle from "./ProjectorToggle";
import QuestionCountdown from "./QuestionCountdown";
import RollCallLists from "./RollCallLists";
import SessionCounters from "./SessionCounters";
import SoundToggle from "./SoundToggle";
import ThemeToggle from "./ThemeToggle";
import { applyProjector, persistProjector, readProjector } from "@/lib/projector";
import { COUNTDOWN_CHANGED_EVENT, resolveCountdownSeconds } from "@/lib/countdown";
import type { ParsedQuestion } from "@/lib/parseQuestions";
import { beginMatch, pickRandom } from "@/lib/randomizer";
import { loadSession, saveSession } from "@/lib/sessionStorage";
import { playRevealChime, unlockAudio } from "@/lib/sound";
import { useMounted } from "@/lib/useMounted";
import type { MatchRecord, Session, Student } from "@/types";

type SaveState = { ok: true; at: string } | { ok: false; error: string } | null;

export default function MatchingScreen({ sessionId }: { sessionId: string }) {
  const mounted = useMounted();

  // Initial read happens once we're in the browser; every mutation afterwards goes through `commit`.
  const initial = useMemo(() => (mounted ? loadSession(sessionId) : undefined), [mounted, sessionId]);
  const [override, setOverride] = useState<Session | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(null);

  useEffect(() => {
    function syncCountdown() {
      const latest = loadSession(sessionId);
      if (!latest || typeof latest.countdownSeconds !== "number") return;
      setOverride((prev) => {
        if (!prev) return latest;
        if (prev.countdownSeconds === latest.countdownSeconds) return prev;
        return { ...prev, countdownSeconds: latest.countdownSeconds };
      });
    }
    window.addEventListener("storage", syncCountdown);
    window.addEventListener(COUNTDOWN_CHANGED_EVENT, syncCountdown);
    return () => {
      window.removeEventListener("storage", syncCountdown);
      window.removeEventListener(COUNTDOWN_CHANGED_EVENT, syncCountdown);
    };
  }, [sessionId]);

  const session = override ?? initial;

  if (initial === undefined) {
    return <Shell><p className="text-sm text-zinc-500">Loading session…</p></Shell>;
  }
  if (!session) {
    return (
      <Shell>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-zinc-900">Session not found</h1>
          <p className="mt-1 text-sm text-zinc-600">
            No saved session with ID <code className="font-mono text-xs">{sessionId}</code> exists on this device.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-zinc-900 underline underline-offset-2">
            Back to session setup
          </Link>
        </div>
      </Shell>
    );
  }

  function commit(next: Session) {
    const latest = loadSession(next.sessionId);
    const stamped =
      latest && typeof latest.countdownSeconds === "number"
        ? { ...next, countdownSeconds: latest.countdownSeconds }
        : next;
    setOverride(stamped);
    const result = saveSession(stamped);
    setSaveState(result.ok ? { ok: true, at: result.savedAt } : { ok: false, error: result.error });
  }

  // Session is already on disk from setup / a previous save — show Saved on first paint, not only after a mutation.
  const displaySave: SaveState = saveState ?? { ok: true, at: new Date().toISOString() };

  return <ActiveSession session={session} saveState={displaySave} commit={commit} />;
}

function ActiveSession({
  session,
  saveState,
  commit,
}: {
  session: Session;
  saveState: SaveState;
  commit: (next: Session) => void;
}) {
  // Not part of the persisted Session shape; falls back to "now" if the page was reloaded mid-match.
  const [matchStartedAt, setMatchStartedAt] = useState<string | null>(null);
  // Purely visual: which columns of the match card are still "spinning". The real pair is already committed.
  const [revealing, setRevealing] = useState<RevealMode>(null);
  const [revealNonce, setRevealNonce] = useState(0);
  const [listsOpen, setListsOpen] = useState(false);
  const [projector, setProjector] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [paused, setPaused] = useState(false);
  const completionSeenRef = useRef(false);
  const handleRevealed = useCallback(() => {
    setRevealing(null);
    playRevealChime();
  }, []);

  // Memoized on the session arrays so the shuffle animation's candidate pools don't change identity mid-spin.
  const pendingStudents = useMemo(() => session.students.filter((s) => s.status === "pending"), [session.students]);
  const pendingQuestions = useMemo(() => session.questions.filter((q) => q.status === "pending"), [session.questions]);
  const current = session.currentMatch ?? null;

  // PRD §7 stopping conditions — only evaluated between matches.
  const studentsDone = pendingStudents.length === 0;
  const questionsDone = pendingQuestions.length === 0;
  const stop: "both" | "students" | "questions" | null = current
    ? null
    : studentsDone && questionsDone
      ? "both"
      : studentsDone
        ? "students"
        : questionsDone
          ? "questions"
          : null;

  function handleBeginMatch() {
    if (paused) return;
    const result = beginMatch(session);
    if (result.status !== "MATCHED") return;
    unlockAudio();
    setMatchStartedAt(new Date().toISOString());
    commit({ ...session, currentMatch: { student: result.student, question: result.question } });
    setRevealNonce((n) => n + 1);
    setRevealing("both");
  }

  function handleMarkComplete() {
    if (!current || revealing || paused) return;
    const now = new Date().toISOString();
    const student = { ...current.student, status: "completed" as const };
    const question = { ...current.question, status: "used" as const };
    const record: MatchRecord = {
      matchId: crypto.randomUUID(),
      student,
      question,
      matchedAt: matchStartedAt ?? now,
      completedAt: now,
      outcome: "completed",
    };
    commit({
      ...session,
      students: session.students.map((s) => (s.id === student.id ? student : s)),
      questions: session.questions.map((q) => (q.id === question.id ? question : q)),
      matches: [...session.matches, record],
      currentMatch: null,
    });
    setMatchStartedAt(null);
  }

  function handleSkip() {
    if (!current || revealing || paused) return;
    const now = new Date().toISOString();
    // Both go back to the pending pool; the attempt is logged as "skipped" for the absence audit trail.
    const student = { ...current.student, status: "pending" as const };
    const question = { ...current.question, status: "pending" as const };
    const record: MatchRecord = {
      matchId: crypto.randomUUID(),
      student,
      question,
      matchedAt: matchStartedAt ?? now,
      completedAt: now,
      outcome: "skipped",
    };
    commit({
      ...session,
      students: session.students.map((s) => (s.id === student.id ? student : s)),
      questions: session.questions.map((q) => (q.id === question.id ? question : q)),
      matches: [...session.matches, record],
      currentMatch: null,
    });
    setMatchStartedAt(null);
  }

  // Keeps the student; the current question returns to the pool and is excluded from the re-pick.
  const reshufflePool = current ? pendingQuestions.filter((q) => q.id !== current.question.id) : [];
  function handleReshuffle() {
    if (!current || revealing || paused || reshufflePool.length === 0) return;
    unlockAudio();
    commit({ ...session, currentMatch: { student: current.student, question: pickRandom(reshufflePool) } });
    setRevealNonce((n) => n + 1);
    setRevealing("question");
  }

  function handleAddQuestions(added: ParsedQuestion[]) {
    commit({ ...session, questions: [...session.questions, ...added] });
  }

  function handleAddStudents(added: Student[]) {
    commit({ ...session, students: [...session.students, ...added] });
  }

  function handleUndoLastMatch() {
    const last = session.matches.at(-1);
    if (!last || last.outcome !== "completed" || current || revealing || paused) return;
    commit({
      ...session,
      students: session.students.map((s) => (s.id === last.student.id ? { ...s, status: "pending" } : s)),
      questions: session.questions.map((q) => (q.id === last.question.id ? { ...q, status: "pending" } : q)),
      matches: session.matches.slice(0, -1),
    });
  }

  const existingQuestionIds = new Set(session.questions.map((q) => q.questionId));
  const existingStudentNumbers = new Set(session.students.map((s) => s.studentNumber));
  const summaryHref = `/session/${session.sessionId}/summary`;
  const canUndo = !current && !revealing && !paused && session.matches.at(-1)?.outcome === "completed";
  const completedCount = session.matches.filter((m) => m.outcome === "completed").length;
  const matchY = session.students.filter((s) => s.status !== "skipped").length;
  const matchX =
    stop === "students" || stop === "both"
      ? Math.min(completedCount, matchY)
      : Math.min(matchY, completedCount + 1);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // PRD §12: shortcuts stay off while any text field (search, upload, module name) is focused.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (paused) return;
      if (listsOpen) return;

      if (e.code === "Space" && !current && stop === null) {
        e.preventDefault();
        handleBeginMatch();
      }
      if (e.key === "Enter" && current && !revealing) {
        e.preventDefault();
        handleMarkComplete();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const on = readProjector();
    setProjector(on);
    applyProjector(on);
    return () => applyProjector(false);
  }, []);

  // Celebrate only when we *arrive* at a successful stop this visit — not on reload of an already-complete session,
  // and never on the questions-exhausted case.
  useEffect(() => {
    if (!completionSeenRef.current) {
      completionSeenRef.current = true;
      return;
    }
    if (stop === "students" || stop === "both") {
      setCelebrate(true);
    } else {
      setCelebrate(false);
    }
  }, [stop]);

  return (
    <Shell>
      <ConfettiBurst active={celebrate} />
      <div className={listsOpen ? "print:hidden" : ""}>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 projector:hidden">Matching session</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 projector:text-5xl">{session.moduleName}</h1>
          <p className="mt-0.5 text-sm text-zinc-600 projector:hidden">{session.dateCreated}</p>
          <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-zinc-900 projector:text-6xl" aria-live="polite">
            Match {matchX} of {matchY}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SessionCounters
            className="projector:fixed projector:right-4 projector:top-4 projector:z-40"
            studentsRemaining={pendingStudents.length}
            studentsTotal={session.students.length}
            questionsRemaining={pendingQuestions.length}
            questionsTotal={session.questions.length}
          />
          <div className="flex items-center gap-3 text-xs print:hidden">
            <span className="projector:hidden">
              <SaveIndicator state={saveState} />
            </span>
            <SoundToggle />
            <ThemeToggle />
            <ProjectorToggle
              on={projector}
              onToggle={() => {
                const next = !projector;
                persistProjector(next);
                setProjector(next);
              }}
            />
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                paused
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              {paused ? "Resume" : "Pause Session"}
            </button>
            <button
              type="button"
              onClick={() => setListsOpen(true)}
              className="font-medium text-zinc-700 underline-offset-2 hover:underline projector:hidden"
            >
              View Full Lists
            </button>
            <Link href={summaryHref} className="font-medium text-zinc-700 underline-offset-2 hover:underline projector:hidden">
              View Summary
            </Link>
            <Link href="/" className="font-medium text-zinc-500 underline-offset-2 hover:underline projector:hidden">
              Setup
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <main className="flex-1 space-y-6">
          {paused && (
            <Banner tone="paused" title="Paused">
              <p className="text-sm">
                Matching is frozen. Begin Match and keyboard shortcuts are disabled until you resume.
              </p>
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="mt-3 rounded-md bg-amber-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-900"
              >
                Resume
              </button>
            </Banner>
          )}
          {stop === "both" && (
            <Banner tone="done" title="Session complete — all students matched and all questions used.">
              <Link href={summaryHref} className={bannerLinkClass}>View summary</Link>
            </Banner>
          )}

          {stop === "students" && (
            <Banner tone="done" title="All students have been tested. Session complete.">
              <Link href={summaryHref} className={bannerLinkClass}>View summary</Link>
              <div className="mt-4 text-sm">
                <p className="font-medium text-zinc-700">Remaining questions — for reference</p>
                <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
                  {pendingQuestions.map((q) => (
                    <li key={q.id} className="px-3 py-2 text-zinc-700">
                      <span className="font-mono text-xs text-zinc-500">{q.questionId}</span> · {q.topic} —{" "}
                      {q.questionText}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 border-t border-emerald-200 pt-4 projector:hidden">
                <p className="mb-2 text-sm text-emerald-900">
                  Need to add a late arrival? Upload more students — completed matches stay as they are.
                </p>
                <AddStudentsPanel existingNumbers={existingStudentNumbers} onAdd={handleAddStudents} />
              </div>
            </Banner>
          )}

          {stop === "questions" && (
            <Banner tone="warn" title="All questions have been exhausted. Please add more questions to continue.">
              <p className="mb-3 text-sm text-amber-900">
                {pendingStudents.length} student{pendingStudents.length === 1 ? "" : "s"} still waiting. New questions
                are merged into the pool without affecting completed matches.
              </p>
              <Link href={summaryHref} className={`${bannerLinkClass} mb-4`}>
                View summary
              </Link>
              <AddQuestionsPanel existingIds={existingQuestionIds} onAdd={handleAddQuestions} />
            </Banner>
          )}

          {current ? (
            <div className="space-y-3">
              <QuestionCountdown
                durationSeconds={resolveCountdownSeconds(session)}
                active={!revealing}
                frozen={paused}
                resetKey={`${revealNonce}-${current.student.id}-${current.question.id}`}
              />
              <MatchCard
                student={current.student}
                question={current.question}
                revealing={revealing}
                revealNonce={revealNonce}
                onRevealed={handleRevealed}
                candidateStudents={pendingStudents}
                candidateQuestions={pendingQuestions}
                canReshuffle={reshufflePool.length > 0}
                onMarkComplete={handleMarkComplete}
                onSkip={handleSkip}
                onReshuffle={handleReshuffle}
                controlsDisabled={paused}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
              <button
                type="button"
                onClick={handleBeginMatch}
                disabled={stop !== null || paused}
                className="rounded-lg bg-zinc-900 px-10 py-5 text-xl font-semibold text-white shadow-md hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none projector:px-16 projector:py-8 projector:text-4xl"
              >
                Begin Match
              </button>
              <p className="mt-4 text-sm text-zinc-500 projector:text-xl">
                {stop
                  ? "Matching is disabled — see the notice above."
                  : paused
                    ? "Session is paused. Resume to begin the next match."
                    : "Randomly pairs one waiting student with one unused question. Space begins a match; Enter marks complete."}
              </p>
              {canUndo && (
                <button
                  type="button"
                  onClick={handleUndoLastMatch}
                  className="mt-4 text-sm font-medium text-zinc-600 underline-offset-2 hover:underline projector:hidden"
                >
                  Undo last match
                </button>
              )}
            </div>
          )}

          {stop !== "students" && (
            <details className="rounded-lg border border-zinc-200 bg-white p-4 text-sm projector:hidden">
              <summary className="cursor-pointer font-medium text-zinc-800">Add students mid-session</summary>
              <p className="mt-2 text-zinc-600">
                New names join the pending pool. Already-completed matches are not changed.
              </p>
              <div className="mt-3">
                <AddStudentsPanel existingNumbers={existingStudentNumbers} onAdd={handleAddStudents} />
              </div>
            </details>
          )}
        </main>

        <div className="projector:hidden">
          <MatchHistoryList matches={session.matches} />
        </div>
      </div>
      </div>
      {listsOpen && (
        <RollCallLists
          moduleName={session.moduleName}
          dateLabel={session.dateCreated}
          students={session.students}
          questions={session.questions}
          onClose={() => setListsOpen(false)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 projector:max-w-none projector:px-10 projector:py-12">{children}</div>
    </div>
  );
}

const bannerLinkClass = "inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 projector:hidden";

function Banner({ tone, title, children }: { tone: "done" | "warn" | "paused"; title: string; children?: React.ReactNode }) {
  const tones = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    paused: "border-amber-400 bg-amber-100 text-amber-950",
  };
  return (
    <section role="status" className={`rounded-lg border p-5 ${tones[tone]}`}>
      <p className="text-base font-semibold projector:text-3xl">{title}</p>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <span role="alert" className="font-medium text-red-700" title={state.error}>
        Save failed
      </span>
    );
  }
  return (
    <span className="text-emerald-700" title={`Saved at ${new Date(state.at).toLocaleTimeString()}`}>
      Saved
    </span>
  );
}
