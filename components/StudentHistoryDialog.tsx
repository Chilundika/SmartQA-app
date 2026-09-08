"use client";

import { useMemo } from "react";
import { studentHistoryForModule } from "@/lib/studentHistory";

type Props = {
  moduleName: string;
  studentNumber: string;
  studentName: string;
  onClose: () => void;
};

export default function StudentHistoryDialog({ moduleName, studentNumber, studentName, onClose }: Props) {
  const entries = useMemo(
    () => studentHistoryForModule(moduleName, studentNumber),
    [moduleName, studentNumber],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center print:hidden">
      <div
        role="dialog"
        aria-labelledby="student-history-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Cross-session history</p>
            <h2 id="student-history-title" className="text-lg font-semibold text-zinc-900">
              {studentName}
            </h2>
            <p className="font-mono text-xs text-zinc-500">{studentNumber}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Questions matched in {moduleName || "this module"} on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No matches recorded for this student in this module yet.</p>
        ) : (
          <ol className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {entries.map((e, i) => (
              <li key={`${e.sessionId}-${e.questionId}-${e.matchedAt}-${i}`} className="px-3 py-3 text-sm">
                <p className="text-zinc-900">{e.questionText}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  <span className="font-mono">{e.questionId}</span> · {e.topic} · {e.dateCreated} ·{" "}
                  {e.outcome === "completed" ? "Completed" : "Skipped"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
