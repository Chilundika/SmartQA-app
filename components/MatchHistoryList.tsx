"use client";

import { useState } from "react";
import type { MatchRecord } from "@/types";

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MatchHistoryList({ matches }: { matches: MatchRecord[] }) {
  const [open, setOpen] = useState(true);

  // Newest first. Skipped attempts are kept apart from completed matches.
  const completed = matches.filter((m) => m.outcome === "completed").reverse();
  const skipped = matches.filter((m) => m.outcome === "skipped").reverse();

  if (!open) {
    return (
      <aside className="lg:w-auto">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 lg:w-auto"
        >
          Show completed matches ({completed.length})
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col rounded-lg border border-zinc-200 bg-white shadow-sm lg:w-80 lg:shrink-0">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          Completed matches so far <span className="text-zinc-500">({completed.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded
          className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          Hide
        </button>
      </div>

      {completed.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">No matches completed yet.</p>
      ) : (
        <ol className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto">
          {completed.map((m, i) => (
            <li key={m.matchId} className="px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-zinc-900">
                  <span className="mr-1.5 text-zinc-400">{completed.length - i}.</span>
                  {m.student.fullName}
                </p>
                <time className="shrink-0 text-xs text-zinc-500">{formatTime(m.completedAt ?? m.matchedAt)}</time>
              </div>
              <p className="font-mono text-xs text-zinc-500">{m.student.studentNumber}</p>
              <p className="mt-1 text-zinc-700">
                <span className="font-mono text-xs text-zinc-500">{m.question.questionId}</span> · {m.question.topic}
              </p>
            </li>
          ))}
        </ol>
      )}

      {skipped.length > 0 && (
        <details className="border-t border-zinc-200 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-700">
            Skipped attempts <span className="text-zinc-500">({skipped.length})</span>
          </summary>
          <ul className="mt-2 space-y-1.5 text-zinc-600">
            {skipped.map((m) => (
              <li key={m.matchId} className="flex items-baseline justify-between gap-2">
                <span>
                  {m.student.fullName} <span className="font-mono text-xs text-zinc-500">· {m.question.questionId}</span>
                </span>
                <time className="shrink-0 text-xs text-zinc-500">{formatTime(m.completedAt ?? m.matchedAt)}</time>
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}
