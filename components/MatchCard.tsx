"use client";

import { useEffect, useRef, useState } from "react";
import { pickRandom } from "@/lib/randomizer";
import type { Question, Student } from "@/types";

/** Which columns should shuffle. `null` = already settled (e.g. after a page reload). */
export type RevealMode = "both" | "question" | null;

const SHUFFLE_MS = 1700;
const STUDENT_LAND_MS = 1300;
const TICK_MIN_MS = 50;
const TICK_SLOWDOWN_MS = 280;

type Props = {
  student: Student;
  question: Question;
  revealing: RevealMode;
  /** Bumped on every Begin Match / Reshuffle so a new spin always restarts. */
  revealNonce: number;
  onRevealed: () => void;
  /** Pools the spinner draws throwaway display values from. Never used for selection. */
  candidateStudents: Student[];
  candidateQuestions: Question[];
  canReshuffle: boolean;
  onMarkComplete: (score?: number) => void;
  onSkip: () => void;
  onReshuffle: () => void;
  controlsDisabled?: boolean;
  completeStep: boolean;
  pickedScore: number;
  onPickedScore: (score: number) => void;
  onRequestComplete: () => void;
  onCancelComplete: () => void;
  /** When set, Mark Complete shows a 0–maxScore stepper/slider. When null, scoring is off. */
  maxScore: number | null;
};

function pickDecoy<T extends { id: string }>(pool: T[], current: T, lastId?: string): T {
  // Prefer anyone except the already-chosen result so the spin doesn't leak the answer.
  const others = pool.filter((item) => item.id !== current.id);
  const choices = others.length > 0 ? others : pool.length > 0 ? pool : [current];
  if (choices.length === 1) return choices[0];
  for (let i = 0; i < 6; i++) {
    const next = pickRandom(choices);
    if (next.id !== lastId) return next;
  }
  return pickRandom(choices);
}

export default function MatchCard({
  student,
  question,
  revealing,
  revealNonce,
  onRevealed,
  candidateStudents,
  candidateQuestions,
  canReshuffle,
  onMarkComplete,
  onSkip,
  onReshuffle,
  controlsDisabled = false,
  completeStep,
  pickedScore,
  onPickedScore,
  onRequestComplete,
  onCancelComplete,
  maxScore,
}: Props) {
  const [shownStudent, setShownStudent] = useState(() =>
    revealing === "both" ? pickDecoy(candidateStudents, student) : student,
  );
  const [shownQuestion, setShownQuestion] = useState(() =>
    revealing === "both" || revealing === "question" ? pickDecoy(candidateQuestions, question) : question,
  );
  const [studentLocked, setStudentLocked] = useState(revealing !== "both");
  const [questionLocked, setQuestionLocked] = useState(revealing === null);
  const [tick, setTick] = useState(0);

  const frameRef = useRef({
    student,
    question,
    candidateStudents,
    candidateQuestions,
    revealing,
    onRevealed,
  });
  useEffect(() => {
    frameRef.current = { student, question, candidateStudents, candidateQuestions, revealing, onRevealed };
  });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame.revealing) {
      setShownStudent(frame.student);
      setShownQuestion(frame.question);
      setStudentLocked(true);
      setQuestionLocked(true);
      return;
    }

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduceMotion) {
      setShownStudent(frame.student);
      setShownQuestion(frame.question);
      setStudentLocked(true);
      setQuestionLocked(true);
      const later = window.setTimeout(() => frameRef.current.onRevealed(), 0);
      return () => clearTimeout(later);
    }

    const spinStudent = frame.revealing === "both";
    const spinQuestion = frame.revealing === "both" || frame.revealing === "question";
    setStudentLocked(!spinStudent);
    setQuestionLocked(!spinQuestion);
    if (!spinStudent) setShownStudent(frame.student);
    if (!spinQuestion) setShownQuestion(frame.question);

    const start = performance.now();
    let lastStudentId = spinStudent ? undefined : frame.student.id;
    let lastQuestionId = spinQuestion ? undefined : frame.question.id;
    let timer: ReturnType<typeof setTimeout>;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      setShownStudent(frameRef.current.student);
      setShownQuestion(frameRef.current.question);
      setStudentLocked(true);
      setQuestionLocked(true);
      frameRef.current.onRevealed();
    };

    const runTick = () => {
      const elapsed = performance.now() - start;
      const now = frameRef.current;

      if (elapsed >= SHUFFLE_MS) {
        finish();
        return;
      }

      const lockStudent = !spinStudent || elapsed >= STUDENT_LAND_MS;
      const lockQuestion = !spinQuestion;

      if (lockStudent) {
        setShownStudent(now.student);
        setStudentLocked(true);
      } else {
        const decoy = pickDecoy(now.candidateStudents, now.student, lastStudentId);
        lastStudentId = decoy.id;
        setShownStudent(decoy);
      }

      if (lockQuestion) {
        setShownQuestion(now.question);
        setQuestionLocked(true);
      } else {
        const decoy = pickDecoy(now.candidateQuestions, now.question, lastQuestionId);
        lastQuestionId = decoy.id;
        setShownQuestion(decoy);
      }

      setTick((n) => n + 1);
      const progress = elapsed / SHUFFLE_MS;
      timer = setTimeout(runTick, TICK_MIN_MS + progress * progress * TICK_SLOWDOWN_MS);
    };

    timer = setTimeout(runTick, 0);
    return () => {
      finished = true;
      clearTimeout(timer);
    };
  }, [revealing, revealNonce]);

  const spinning = revealing !== null;
  const studentSpinning = spinning && !studentLocked;
  const questionSpinning = spinning && !questionLocked;
  const buttonsOff = spinning || controlsDisabled;

  return (
    <>
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm" aria-busy={spinning} aria-live="polite">
      <div className="grid gap-px bg-zinc-200 md:grid-cols-2">
        <section className="overflow-hidden bg-white p-4 sm:p-6 projector:p-10">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Student
            {studentSpinning && (
              <span className="ml-2 normal-case tracking-normal text-zinc-400">selecting…</span>
            )}
          </p>
          {studentSpinning ? (
            <div key={`s-${tick}`} className="animate-shuffle-tick">
              <p className="mt-1 font-mono text-sm text-zinc-400 sm:mt-2 sm:text-lg projector:text-2xl">
                {shownStudent.studentNumber}
              </p>
              <p className="mt-0.5 text-xl font-semibold leading-tight text-zinc-400 sm:mt-1 sm:text-3xl projector:text-6xl">
                {shownStudent.fullName}
              </p>
            </div>
          ) : (
            <div key={`s-settled-${shownStudent.id}-${revealNonce}`} className="animate-reveal">
              <p className="mt-1 font-mono text-sm text-zinc-600 sm:mt-2 sm:text-lg projector:text-2xl">
                {shownStudent.studentNumber}
              </p>
              <p className="mt-0.5 text-xl font-semibold leading-tight text-zinc-900 sm:mt-1 sm:text-3xl projector:text-6xl">
                {shownStudent.fullName}
              </p>
            </div>
          )}
        </section>

        <section className="overflow-hidden bg-white p-4 sm:p-6 projector:p-10">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Question
            {questionSpinning && (
              <span className="ml-2 normal-case tracking-normal text-zinc-400">selecting…</span>
            )}
          </p>
          {questionSpinning ? (
            <div key={`q-${tick}`} className="animate-shuffle-tick">
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                  {shownQuestion.topic}
                </span>
              </div>
              <p className="mt-2 text-lg font-medium leading-snug text-zinc-300 sm:mt-3 sm:text-2xl">···</p>
            </div>
          ) : (
            <div key={`q-settled-${shownQuestion.id}-${revealNonce}`} className="animate-reveal">
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white">
                  {shownQuestion.topic}
                </span>
                <span className="font-mono text-sm text-zinc-500">{shownQuestion.questionId}</span>
              </div>
              <p className="mt-2 max-h-[min(9.5rem,28vh)] overflow-y-auto text-lg font-medium leading-snug text-zinc-900 sm:mt-3 sm:max-h-none sm:text-2xl projector:max-h-none projector:text-5xl">
                {shownQuestion.questionText}
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="match-actions-dock border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-6 sm:py-4">
        {completeStep && !spinning && maxScore !== null ? (
          <div className="flex max-h-[min(70dvh,22rem)] w-full flex-col gap-3 overflow-y-auto">
            <p className="text-sm font-medium text-zinc-800">
              Score this answer <span className="font-normal text-zinc-500">(0–{maxScore})</span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-label="Decrease score"
                disabled={controlsDisabled || (pickedScore ?? 0) <= 0}
                onClick={() => onPickedScore(Math.max(0, (pickedScore ?? 0) - 1))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-zinc-300 bg-white text-lg font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={maxScore}
                step={1}
                value={pickedScore ?? 0}
                disabled={controlsDisabled}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) {
                    onPickedScore(0);
                    return;
                  }
                  onPickedScore(Math.min(maxScore, Math.max(0, Math.round(n))));
                }}
                className="h-11 w-20 rounded-md border border-zinc-300 bg-white px-2 text-center text-sm font-semibold tabular-nums"
              />
              <button
                type="button"
                aria-label="Increase score"
                disabled={controlsDisabled || (pickedScore ?? 0) >= maxScore}
                onClick={() => onPickedScore(Math.min(maxScore, (pickedScore ?? 0) + 1))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-zinc-300 bg-white text-lg font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
              <input
                type="range"
                min={0}
                max={maxScore}
                step={1}
                value={pickedScore ?? 0}
                disabled={controlsDisabled}
                onChange={(e) => onPickedScore(Number(e.target.value))}
                className="h-11 min-w-0 flex-1 basis-full sm:min-w-48 sm:basis-auto"
                aria-label={`Score out of ${maxScore}`}
              />
              <span className="text-sm tabular-nums text-zinc-600">
                {pickedScore ?? 0} / {maxScore}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onMarkComplete(pickedScore ?? 0)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed sm:flex-none projector:px-8 projector:py-4 projector:text-2xl"
                disabled={controlsDisabled}
              >
                Confirm complete
              </button>
              <button
                type="button"
                onClick={onCancelComplete}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <div className="flex w-full gap-2 sm:w-auto sm:flex-1">
              <button
                type="button"
                onClick={onRequestComplete}
                disabled={buttonsOff}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 disabled:shadow-none sm:flex-none sm:px-5 projector:px-8 projector:py-4 projector:text-2xl"
              >
                Mark Complete
              </button>
              <button
                type="button"
                onClick={onSkip}
                disabled={buttonsOff}
                aria-label="Skip / Student Absent"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:shadow-none sm:flex-none sm:px-5 projector:px-8 projector:py-4 projector:text-xl"
              >
                <span className="sm:hidden">Skip</span>
                <span className="hidden sm:inline">Skip / Student Absent</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onReshuffle}
              disabled={!canReshuffle || buttonsOff}
              title={canReshuffle ? "Keep this student, pick a different question" : "No other questions left to pick from"}
              className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300 sm:ml-auto projector:hidden"
            >
              Reshuffle Question
            </button>
          </div>
        )}
      </div>
    </div>
      <div
        className={`match-actions-spacer hidden ${completeStep && !spinning && maxScore !== null ? "is-scoring" : ""}`}
        aria-hidden
      />
    </>
  );
}
