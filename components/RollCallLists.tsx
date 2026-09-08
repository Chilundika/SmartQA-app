"use client";

import { useMemo, useState } from "react";
import type { Question, Student } from "@/types";
import StudentHistoryDialog from "./StudentHistoryDialog";
import TopicCoverageChart from "./TopicCoverageChart";

export type ListStudent = Pick<Student, "id" | "studentNumber" | "fullName" | "status">;
export type ListQuestion = Pick<Question, "id" | "questionId" | "topic" | "questionText" | "status">;

type Tab = "students" | "questions";

type Props = {
  moduleName: string;
  dateLabel?: string;
  students: readonly ListStudent[];
  questions: readonly ListQuestion[];
  onClose: () => void;
  /** Screen 1: ticking marks a student absent so they never enter the match pool. */
  excludeMode?: boolean;
  excludedIds?: ReadonlySet<string>;
  onToggleExcluded?: (id: string) => void;
};

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

function compareStudentNumber(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-700">
      {status}
    </span>
  );
}

/**
 * Screen 1a — roll call / list preview.
 * In excludeMode (before Start Session), Absent ticks are owned by the parent and applied as status: "skipped".
 * During a live session, attendance ticks stay local and are never written to Session.
 */
export default function RollCallLists({
  moduleName,
  dateLabel,
  students,
  questions,
  onClose,
  excludeMode = false,
  excludedIds,
  onToggleExcluded,
}: Props) {
  const [tab, setTab] = useState<Tab>("students");
  const [studentQuery, setStudentQuery] = useState("");
  const [questionQuery, setQuestionQuery] = useState("");
  const [present, setPresent] = useState<ReadonlySet<string>>(() => new Set());
  const [historyStudent, setHistoryStudent] = useState<ListStudent | null>(null);

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => compareStudentNumber(a.studentNumber, b.studentNumber)),
    [students],
  );

  const visibleStudents = useMemo(() => {
    if (!studentQuery.trim()) return sortedStudents;
    return sortedStudents.filter(
      (s) => matchesQuery(s.fullName, studentQuery) || matchesQuery(s.studentNumber, studentQuery),
    );
  }, [sortedStudents, studentQuery]);

  const visibleQuestions = useMemo(() => {
    if (!questionQuery.trim()) return questions;
    return questions.filter(
      (q) =>
        matchesQuery(q.questionId, questionQuery) ||
        matchesQuery(q.topic, questionQuery) ||
        matchesQuery(q.questionText, questionQuery),
    );
  }, [questions, questionQuery]);

  function togglePresent(id: string) {
    if (excludeMode) {
      onToggleExcluded?.(id);
      return;
    }
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ticked = excludeMode ? (excludedIds ?? new Set<string>()) : present;

  return (
    <div className="roll-call-overlay fixed inset-0 z-40 overflow-y-auto bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Roll call / list preview</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{moduleName || "Untitled session"}</h1>
            {dateLabel && <p className="mt-0.5 text-sm text-zinc-600">{dateLabel}</p>}
            <p className="mt-2 text-sm text-zinc-500">
              {excludeMode
                ? "Tick students who are known absent. They are skipped when you start and never enter the random pool."
                : "Status is shown for reference only. Ticking attendance does not change who can be matched."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 print:hidden sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Print list
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </header>

        <div className="mb-4 flex gap-1 print:hidden" role="tablist" aria-label="List type">
          <TabButton active={tab === "students"} onClick={() => setTab("students")}>
            Students ({students.length})
          </TabButton>
          <TabButton active={tab === "questions"} onClick={() => setTab("questions")}>
            Questions ({questions.length})
          </TabButton>
        </div>

        {tab === "students" ? (
          <section>
            <h2 className="mb-3 hidden text-lg font-semibold print:block">Students</h2>
            <label className="mb-3 block print:hidden">
              <span className="sr-only">Search students</span>
              <input
                type="search"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Find a student by name or number"
                className="min-h-11 w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 text-sm"
              />
            </label>
            <p className="mb-2 text-xs text-zinc-500 print:hidden">
              {visibleStudents.length} shown
              {ticked.size > 0 &&
                (excludeMode
                  ? ` · ${ticked.size} marked absent`
                  : ` · ${ticked.size} ticked present (this device only)`)}
            </p>
            <ul className="space-y-2 md:hidden print:hidden">
              {visibleStudents.length === 0 ? (
                <li className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                  No students match this search.
                </li>
              ) : (
                visibleStudents.map((s) => (
                  <li key={s.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <label className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
                        <input
                          type="checkbox"
                          checked={ticked.has(s.id)}
                          onChange={() => togglePresent(s.id)}
                          aria-label={
                            excludeMode
                              ? `Mark ${s.fullName} absent`
                              : `Mark ${s.fullName} present for roll call`
                          }
                          className="h-5 w-5"
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setHistoryStudent(s)}
                          className="min-h-11 text-left font-medium text-zinc-900 underline-offset-2 hover:underline"
                        >
                          {s.fullName}
                        </button>
                        <p className="font-mono text-xs text-zinc-500">{s.studentNumber}</p>
                        <div className="mt-2">
                          <StatusBadge status={s.status} />
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block print:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="w-12 px-4 py-3 font-medium">
                      <span className="print:hidden">{excludeMode ? "Absent" : "Present"}</span>
                      <span className="hidden print:inline">✓</span>
                    </th>
                    <th className="px-4 py-3 font-medium">Student number</th>
                    <th className="px-4 py-3 font-medium">Full name</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visibleStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                        No students match this search.
                      </td>
                    </tr>
                  ) : (
                    visibleStudents.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-2">
                          <label className="inline-flex min-h-11 min-w-11 items-center justify-center">
                            <input
                              type="checkbox"
                              checked={ticked.has(s.id)}
                              onChange={() => togglePresent(s.id)}
                              aria-label={
                                excludeMode
                                  ? `Mark ${s.fullName} absent`
                                  : `Mark ${s.fullName} present for roll call`
                              }
                              className="h-5 w-5"
                            />
                          </label>
                        </td>
                        <td className="px-4 py-2 font-mono text-zinc-800">{s.studentNumber}</td>
                        <td className="px-4 py-2 text-zinc-900">
                          <button
                            type="button"
                            onClick={() => setHistoryStudent(s)}
                            className="inline-flex min-h-11 items-center text-left font-medium underline-offset-2 hover:underline print:hidden"
                          >
                            {s.fullName}
                          </button>
                          <span className="hidden print:inline">{s.fullName}</span>
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={s.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section>
            <h2 className="mb-3 hidden text-lg font-semibold print:block">Questions</h2>
            <div className="mb-4 print:hidden">
              <TopicCoverageChart questions={questions} />
            </div>
            <label className="mb-3 block print:hidden">
              <span className="sr-only">Search questions</span>
              <input
                type="search"
                value={questionQuery}
                onChange={(e) => setQuestionQuery(e.target.value)}
                placeholder="Find a question by id, topic, or text"
                className="min-h-11 w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 text-sm"
              />
            </label>
            <p className="mb-2 text-xs text-zinc-500 print:hidden">{visibleQuestions.length} shown</p>
            <ul className="space-y-2 md:hidden print:hidden">
              {visibleQuestions.length === 0 ? (
                <li className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                  No questions match this search.
                </li>
              ) : (
                visibleQuestions.map((q) => (
                  <li key={q.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">{q.questionId}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {q.topic}
                      </span>
                      <StatusBadge status={q.status} />
                    </div>
                    <p className="mt-2 text-sm text-zinc-900">{q.questionText}</p>
                  </li>
                ))
              )}
            </ul>
            <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block print:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Question id</th>
                    <th className="px-4 py-3 font-medium">Topic</th>
                    <th className="px-4 py-3 font-medium">Question text</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visibleQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                        No questions match this search.
                      </td>
                    </tr>
                  ) : (
                    visibleQuestions.map((q) => (
                      <tr key={q.id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-2 font-mono text-zinc-800">{q.questionId}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-zinc-800">{q.topic}</td>
                        <td className="px-4 py-2 text-zinc-900">{q.questionText}</td>
                        <td className="px-4 py-2">
                          <StatusBadge status={q.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      {historyStudent && (
        <StudentHistoryDialog
          moduleName={moduleName}
          studentNumber={historyStudent.studentNumber}
          studentName={historyStudent.fullName}
          onClose={() => setHistoryStudent(null)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium sm:flex-none ${
        active ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}
