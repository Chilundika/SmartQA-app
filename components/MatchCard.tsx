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
  onMarkComplete: () => void;
  onSkip: () => void;
  onReshuffle: () => void;
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

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm" aria-busy={spinning} aria-live="polite">
      <div className="grid gap-px bg-zinc-200 md:grid-cols-2">
        <section className="overflow-hidden bg-white p-6 projector:p-10">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Student
            {studentSpinning && (
              <span className="ml-2 normal-case tracking-normal text-zinc-400">selecting…</span>
            )}
          </p>
          {studentSpinning ? (
            <div key={`s-${tick}`} className="animate-shuffle-tick">
              <p className="mt-2 font-mono text-lg text-zinc-400 projector:text-2xl">{shownStudent.studentNumber}</p>
              <p className="mt-1 text-3xl font-semibold leading-tight text-zinc-400 projector:text-6xl">{shownStudent.fullName}</p>
            </div>
          ) : (
            <div key={`s-settled-${shownStudent.id}-${revealNonce}`} className="animate-reveal">
              <p className="mt-2 font-mono text-lg text-zinc-600 projector:text-2xl">{shownStudent.studentNumber}</p>
              <p className="mt-1 text-3xl font-semibold leading-tight text-zinc-900 projector:text-6xl">{shownStudent.fullName}</p>
            </div>
          )}
        </section>

        <section className="overflow-hidden bg-white p-6 projector:p-10">
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
              <p className="mt-3 text-2xl font-medium leading-snug text-zinc-300">···</p>
            </div>
          ) : (
            <div key={`q-settled-${shownQuestion.id}-${revealNonce}`} className="animate-reveal">
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white">
                  {shownQuestion.topic}
                </span>
                <span className="font-mono text-sm text-zinc-500">{shownQuestion.questionId}</span>
              </div>
              <p className="mt-3 text-2xl font-medium leading-snug text-zinc-900 projector:text-5xl">{shownQuestion.questionText}</p>
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
        <button
          type="button"
          onClick={onMarkComplete}
          disabled={spinning}
          className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 disabled:shadow-none projector:px-8 projector:py-4 projector:text-2xl"
        >
          Mark Complete
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={spinning}
          className="rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:shadow-none projector:px-8 projector:py-4 projector:text-xl"
        >
          Skip / Student Absent
        </button>
        <button
          type="button"
          onClick={onReshuffle}
          disabled={!canReshuffle || spinning}
          title={canReshuffle ? "Keep this student, pick a different question" : "No other questions left to pick from"}
          className="ml-auto text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300 projector:hidden"
        >
          Reshuffle Question
        </button>
      </div>
    </div>
  );
}
