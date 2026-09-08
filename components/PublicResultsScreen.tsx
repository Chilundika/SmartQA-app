"use client";

import { useEffect, useState } from "react";
import { loadSession } from "@/lib/sessionStorage";
import { useMounted } from "@/lib/useMounted";
import type { Session } from "@/types";

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function PublicResultsScreen({ sessionId }: { sessionId: string }) {
  const mounted = useMounted();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!mounted) return;

    function refresh() {
      setSession(loadSession(sessionId));
    }

    refresh();
    const poll = window.setInterval(refresh, 1500);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("storage", refresh);
    };
  }, [mounted, sessionId]);

  if (session === undefined) {
    return (
      <div className="flex-1 bg-zinc-50 text-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
          <p className="text-sm text-zinc-500">Loading results…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 bg-zinc-50 text-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
            <h1 className="text-xl font-semibold text-zinc-900">Session not found</h1>
            <p className="mt-2 text-sm text-zinc-600">
              This results board is only available on the same device and browser where the session is running.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const completed = session.matches.filter((m) => m.outcome === "completed").reverse();

  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <header className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Live results</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">{session.moduleName}</h1>
          <p className="mt-1 text-sm text-zinc-600">{session.dateCreated}</p>
          <p className="mt-3 text-lg tabular-nums text-zinc-700" aria-live="polite">
            {completed.length === 0
              ? "Waiting for the first completed match…"
              : `${completed.length} completed`}
          </p>
        </header>

        {completed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center text-zinc-500">
            Matches will appear here as they are marked complete.
          </p>
        ) : (
          <ol className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            {completed.map((m, i) => (
              <li key={m.matchId} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-zinc-900">
                    <span className="mr-2 text-zinc-400">{completed.length - i}.</span>
                    {m.student.fullName}
                  </p>
                  <p className="mt-1 text-base text-zinc-600">{m.question.topic}</p>
                </div>
                <time className="shrink-0 text-sm text-zinc-500">{formatTime(m.completedAt ?? m.matchedAt)}</time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
