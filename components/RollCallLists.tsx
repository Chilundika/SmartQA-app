"use client";

import { useMemo, useState } from "react";
import type { Question, Student } from "@/types";

export type ListStudent = Pick<Student, "id" | "studentNumber" | "fullName" | "status">;
export type ListQuestion = Pick<Question, "id" | "questionId" | "topic" | "questionText" | "status">;

type Tab = "students" | "questions";

type Props = {
  moduleName: string;
  dateLabel?: string;
  students: readonly ListStudent[];
  questions: readonly ListQuestion[];
  onClose: () => void;
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
 * Screen 1a — roll call / list preview. Read-only for session status:
 * attendance ticks live only in this component's React state and are never
 * written to Session or used by beginMatch.
 */
export default function RollCallLists({ moduleName, dateLabel, students, questions, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("students");
  const [studentQuery, setStudentQuery] = useState("");
  const [questionQuery, setQuestionQuery] = useState("");
  const [present, setPresent] = useState<ReadonlySet<string>>(() => new Set());

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
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="roll-call-overlay fixed inset-0 z-40 overflow-y-auto bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Roll call / list preview</p>
            <h1 className="text-2xl font-semibold tracking-tight">{moduleName || "Untitled session"}</h1>
            {dateLabel && <p className="mt-0.5 text-sm text-zinc-600">{dateLabel}</p>}
            <p className="mt-2 text-sm text-zinc-500">
              Status is shown for reference only. Ticking attendance does not change who can be matched.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Print list
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
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
                className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <p className="mb-2 text-xs text-zinc-500 print:hidden">
              {visibleStudents.length} shown
              {present.size > 0 && ` · ${present.size} ticked present (this device only)`}
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="w-12 px-4 py-3 font-medium">
                      <span className="print:hidden">Present</span>
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
                          <input
                            type="checkbox"
                            checked={present.has(s.id)}
                            onChange={() => togglePresent(s.id)}
                            aria-label={`Mark ${s.fullName} present for roll call`}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="px-4 py-2 font-mono text-zinc-800">{s.studentNumber}</td>
                        <td className="px-4 py-2 text-zinc-900">{s.fullName}</td>
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
            <label className="mb-3 block print:hidden">
              <span className="sr-only">Search questions</span>
              <input
                type="search"
                value={questionQuery}
                onChange={(e) => setQuestionQuery(e.target.value)}
                placeholder="Find a question by id, topic, or text"
                className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <p className="mb-2 text-xs text-zinc-500 print:hidden">{visibleQuestions.length} shown</p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
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
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}
