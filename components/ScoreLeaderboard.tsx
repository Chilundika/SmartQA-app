"use client";

import { useMemo, useState } from "react";
import type { MatchRecord } from "@/types";

type SortDir = "desc" | "asc";

export default function ScoreLeaderboard({
  matches,
  maxScore,
}: {
  matches: readonly MatchRecord[];
  maxScore?: number | null;
}) {
  const [dir, setDir] = useState<SortDir>("desc");

  const ranked = useMemo(() => {
    const scored = matches.filter((m) => m.outcome === "completed" && typeof m.score === "number");
    return [...scored].sort((a, b) => {
      const diff = (b.score ?? 0) - (a.score ?? 0);
      return dir === "desc" ? diff : -diff;
    });
  }, [matches, dir]);

  if (ranked.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">Leaderboard</h2>
        <div className="flex items-center gap-2">
          <p className="text-xs text-zinc-500">{ranked.length} scored</p>
          <button
            type="button"
            onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 md:hidden print:hidden"
          >
            Score {dir === "desc" ? "↓" : "↑"}
          </button>
        </div>
      </div>
      <ul className="space-y-2 md:hidden print:hidden">
        {ranked.map((m, i) => (
          <li key={m.matchId} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-xs tabular-nums text-zinc-500">#{i + 1}</p>
              <p className="font-medium text-zinc-900">{m.student.fullName}</p>
              <p className="font-mono text-xs text-zinc-500">{m.student.studentNumber}</p>
              <p className="mt-1 text-sm text-zinc-700">{m.question.topic}</p>
            </div>
            <p className="shrink-0 text-lg font-semibold tabular-nums text-zinc-900">
              {maxScore ? `${m.score} / ${maxScore}` : m.score}
            </p>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm md:block print:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Topic</th>
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
                  className="inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline"
                >
                  Score {dir === "desc" ? "↓" : "↑"}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ranked.map((m, i) => (
              <tr key={m.matchId}>
                <td className="px-4 py-3 tabular-nums text-zinc-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">{m.student.fullName}</p>
                  <p className="font-mono text-xs text-zinc-500">{m.student.studentNumber}</p>
                </td>
                <td className="px-4 py-3 text-zinc-800">{m.question.topic}</td>
                <td className="px-4 py-3 text-lg font-semibold tabular-nums text-zinc-900">
                  {maxScore ? `${m.score} / ${maxScore}` : m.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
