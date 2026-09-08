"use client";

import { topicCoverage } from "@/lib/topicCoverage";
import type { Question } from "@/types";

export default function TopicCoverageChart({ questions }: { questions: readonly Pick<Question, "topic" | "status">[] }) {
  const rows = topicCoverage(questions);
  if (rows.length === 0) return null;

  const usedAll = rows.reduce((n, r) => n + r.used, 0);
  const totalAll = rows.reduce((n, r) => n + r.total, 0);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Topic coverage">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Topic coverage</h2>
        <p className="text-xs tabular-nums text-zinc-500">
          {usedAll} used · {totalAll - usedAll} remaining
        </p>
      </div>
      <ul className="space-y-3">
        {rows.map((row) => {
          const usedPct = row.total === 0 ? 0 : (row.used / row.total) * 100;
          return (
            <li key={row.topic}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium text-zinc-800" title={row.topic}>
                  {row.topic}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-500">
                  {row.used}/{row.total}
                </span>
              </div>
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-zinc-200"
                role="img"
                aria-label={`${row.topic}: ${row.used} used, ${row.remaining} remaining`}
              >
                <span
                  className="h-full bg-zinc-900"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-3 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-zinc-900" aria-hidden />
          Used
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-zinc-200 ring-1 ring-zinc-300" aria-hidden />
          Remaining
        </span>
      </p>
    </section>
  );
}
