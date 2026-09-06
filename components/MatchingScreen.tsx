"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import AddQuestionsPanel from "./AddQuestionsPanel";
import MatchCard from "./MatchCard";
import MatchHistoryList from "./MatchHistoryList";
import SessionCounters from "./SessionCounters";
import type { ParsedQuestion } from "@/lib/parseQuestions";
import { beginMatch, pickRandom } from "@/lib/randomizer";
import { loadSession, saveSession } from "@/lib/sessionStorage";
import { useMounted } from "@/lib/useMounted";
import type { MatchRecord, Session } from "@/types";

type SaveState = { ok: true; at: string } | { ok: false; error: string } | null;

export default function MatchingScreen({ sessionId }: { sessionId: string }) {
  const mounted = useMounted();

  // Initial read happens once we're in the browser; every mutation afterwards goes through `commit`.
  const initial = useMemo(() => (mounted ? loadSession(sessionId) : undefined), [mounted, sessionId]);
  const [override, setOverride] = useState<Session | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(null);

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
    setOverride(next);
    const result = saveSession(next);
    setSaveState(result.ok ? { ok: true, at: result.savedAt } : { ok: false, error: result.error });
  }

  return <ActiveSession session={session} saveState={saveState} commit={commit} />;
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

  const pendingStudents = session.students.filter((s) => s.status === "pending");
  const pendingQuestions = session.questions.filter((q) => q.status === "pending");
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
    const result = beginMatch(session);
    if (result.status !== "MATCHED") return;
    setMatchStartedAt(new Date().toISOString());
    commit({ ...session, currentMatch: { student: result.student, question: result.question } });
  }

  function handleMarkComplete() {
    if (!current) return;
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
    if (!current) return;
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
    if (!current || reshufflePool.length === 0) return;
    commit({ ...session, currentMatch: { student: current.student, question: pickRandom(reshufflePool) } });
  }

  function handleAddQuestions(added: ParsedQuestion[]) {
    commit({ ...session, questions: [...session.questions, ...added] });
  }

  const existingQuestionIds = new Set(session.questions.map((q) => q.questionId));
  const summaryHref = `/session/${session.sessionId}/summary`;

  return (
    <Shell>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Matching session</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{session.moduleName}</h1>
          <p className="mt-0.5 text-sm text-zinc-600">{session.dateCreated}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SessionCounters
            studentsRemaining={pendingStudents.length}
            studentsTotal={session.students.length}
            questionsRemaining={pendingQuestions.length}
            questionsTotal={session.questions.length}
          />
          <div className="flex items-center gap-3 text-xs">
            <SaveIndicator state={saveState} />
            <Link href={summaryHref} className="font-medium text-zinc-700 underline-offset-2 hover:underline">
              View Summary
            </Link>
            <Link href="/" className="font-medium text-zinc-500 underline-offset-2 hover:underline">
              Setup
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <main className="flex-1 space-y-6">
          {stop === "both" && (
            <Banner tone="done" title="Session complete — all students matched and all questions used.">
              <Link href={summaryHref} className={bannerLinkClass}>View summary</Link>
            </Banner>
          )}

          {stop === "students" && (
            <Banner tone="done" title="All students have been tested. Session complete.">
              <Link href={summaryHref} className={bannerLinkClass}>View summary</Link>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium text-zinc-700">
                  Remaining questions ({pendingQuestions.length}) — for reference
                </summary>
                <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
                  {pendingQuestions.map((q) => (
                    <li key={q.id} className="px-3 py-2 text-zinc-700">
                      <span className="font-mono text-xs text-zinc-500">{q.questionId}</span> · {q.topic} —{" "}
                      {q.questionText}
                    </li>
                  ))}
                </ul>
              </details>
            </Banner>
          )}

          {stop === "questions" && (
            <Banner tone="warn" title="All questions have been exhausted. Please add more questions to continue.">
              <p className="mb-3 text-sm text-amber-900">
                {pendingStudents.length} student{pendingStudents.length === 1 ? "" : "s"} still waiting. New questions
                are merged into the pool without affecting completed matches.
              </p>
              <AddQuestionsPanel existingIds={existingQuestionIds} onAdd={handleAddQuestions} />
            </Banner>
          )}

          {current ? (
            <MatchCard
              student={current.student}
              question={current.question}
              canReshuffle={reshufflePool.length > 0}
              onMarkComplete={handleMarkComplete}
              onSkip={handleSkip}
              onReshuffle={handleReshuffle}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
              <button
                type="button"
                onClick={handleBeginMatch}
                disabled={stop !== null}
                className="rounded-lg bg-zinc-900 px-10 py-5 text-xl font-semibold text-white shadow-md hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
              >
                Begin Match
              </button>
              <p className="mt-4 text-sm text-zinc-500">
                {stop
                  ? "Matching is disabled — see the notice above."
                  : "Randomly pairs one waiting student with one unused question."}
              </p>
            </div>
          )}
        </main>

        <MatchHistoryList matches={session.matches} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}

const bannerLinkClass = "inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800";

function Banner({ tone, title, children }: { tone: "done" | "warn"; title: string; children?: React.ReactNode }) {
  const tones = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
  };
  return (
    <section role="status" className={`rounded-lg border p-5 ${tones[tone]}`}>
      <p className="text-base font-semibold">{title}</p>
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
