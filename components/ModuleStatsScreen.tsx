"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { computeModuleStats } from "@/lib/moduleStats";
import { listModuleNames, normalizeModuleKey } from "@/lib/sessionStorage";
import { useMounted } from "@/lib/useMounted";
import ThemeToggle from "@/components/ThemeToggle";

export default function ModuleStatsScreen({ initialModule }: { initialModule: string }) {
  const router = useRouter();
  const mounted = useMounted();
  const modules = useMemo(() => (mounted ? listModuleNames() : []), [mounted]);
  const [selected, setSelected] = useState(initialModule);

  const options = useMemo(() => {
    const names = [...modules];
    const typed = initialModule.trim();
    if (typed && !names.some((n) => normalizeModuleKey(n) === normalizeModuleKey(typed))) {
      names.unshift(typed);
    }
    return names;
  }, [modules, initialModule]);

  const active = useMemo(() => {
    const want = normalizeModuleKey(selected || initialModule);
    return options.find((n) => normalizeModuleKey(n) === want) ?? options[0] ?? "";
  }, [selected, initialModule, options]);

  const stats = useMemo(
    () => (mounted && active ? computeModuleStats(active) : null),
    [mounted, active],
  );

  function handleSelect(name: string) {
    setSelected(name);
    router.replace(name ? `/stats?module=${encodeURIComponent(name)}` : "/stats");
  }

  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Read-only</p>
            <h1 className="text-2xl font-semibold tracking-tight">Module stats</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Aggregates every saved session for a module on this device. Nothing here writes session data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Back to setup
            </Link>
          </div>
        </header>

        {!mounted ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : options.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
            No saved sessions on this device yet.
          </p>
        ) : (
          <div className="space-y-6">
            <label className="block max-w-md text-sm">
              <span className="mb-1 block font-medium text-zinc-700">Module</span>
              <select
                value={active}
                onChange={(e) => handleSelect(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              >
                {options.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            {stats && (
              <>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <StatCard label="Sessions run" value={String(stats.sessionCount)} />
                  <StatCard label="Students tested" value={String(stats.uniqueStudentsTested)} hint="Unique student numbers with a completed match" />
                  <StatCard label="Completed matches" value={String(stats.completedMatches)} />
                </dl>

                <div className="grid gap-3 sm:grid-cols-2">
                  <StatCard
                    label="Most-used topic"
                    value={stats.mostUsed ? `${stats.mostUsed.topic} (${stats.mostUsed.used})` : "—"}
                  />
                  <StatCard
                    label="Least-used topic"
                    value={stats.leastUsed ? `${stats.leastUsed.topic} (${stats.leastUsed.used})` : "—"}
                  />
                </div>

                {stats.topics.length > 0 && (
                  <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-zinc-900">Topics across all sessions</h2>
                    <ul className="space-y-2 text-sm">
                      {stats.topics.map((t) => (
                        <li key={t.topic} className="flex justify-between gap-3">
                          <span className="text-zinc-800">{t.topic}</span>
                          <span className="tabular-nums text-zinc-500">
                            {t.used} used · {t.remaining} remaining
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-zinc-900">{value}</dd>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
