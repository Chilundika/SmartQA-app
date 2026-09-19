"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";
import { loadStudentProfile, type StudentProfile } from "@/lib/auth/student";
import { signOutSession } from "@/lib/auth/session";
import { logSupabaseError } from "@/lib/db/errors";
import { loadStudentProgress, type StudentProgress } from "@/lib/db/studentProgress";
import { createClient } from "@/lib/supabase/client";

export default function StudentDashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data, error: userError }) => {
      if (cancelled) return;
      if (userError) {
        logSupabaseError("student.dashboard getUser", userError);
        setError("Could not load your session. Sign in again.");
        return;
      }
      const userId = data.user?.id;
      if (!userId) {
        setError("Could not load your session. Sign in again.");
        return;
      }

      const [loaded, history] = await Promise.all([loadStudentProfile(userId), loadStudentProgress()]);
      if (cancelled) return;
      if (!loaded.ok) {
        setError(loaded.error);
        return;
      }
      if (!history.ok) {
        setProfile(loaded.profile);
        setError(history.error);
        return;
      }
      setProfile(loaded.profile);
      setProgress(history.progress);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOutSession();
    router.replace("/");
    router.refresh();
  }

  const empty = progress && progress.matches.length === 0;

  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Student</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Check progression</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-4">
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}

          {!error && !profile && <p className="text-sm text-zinc-600">Loading…</p>}

          {profile && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-lg font-medium text-zinc-900">Welcome, {profile.fullName}</p>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="mt-4 inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-400"
              >
                {signingOut ? "Signing out…" : "Log out"}
              </button>
            </div>
          )}

          {profile && !error && !progress && <p className="text-sm text-zinc-600">Loading your history…</p>}

          {empty && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-base font-medium text-zinc-900">No sessions yet</p>
              <p className="mt-1 text-sm text-zinc-600">
                When your lecturer matches you in a session, your questions and scores will appear here.
              </p>
            </div>
          )}

          {progress && progress.matches.length > 0 && (
            <>
              <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-900">Summary</h2>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Questions answered</dt>
                    <dd className="mt-1 text-lg font-medium text-zinc-900">{progress.summary.answeredCount}</dd>
                  </div>
                  {progress.summary.averageLabel && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Average score</dt>
                      <dd className="mt-1 text-lg font-medium text-zinc-900">{progress.summary.averageLabel}</dd>
                    </div>
                  )}
                  <div className={progress.summary.averageLabel ? "" : "sm:col-span-2"}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Topics covered</dt>
                    <dd className="mt-1 text-sm text-zinc-800">
                      {progress.summary.topics.length > 0 ? progress.summary.topics.join(", ") : "None yet"}
                    </dd>
                  </div>
                </dl>
              </section>

              <HistoryTable progress={progress} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function HistoryTable({ progress }: { progress: StudentProgress }) {
  const showScore = progress.matches.some((match) => match.scoreLabel);
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <h2 className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900">History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Module</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Topic</th>
              <th className="px-5 py-2.5 font-medium">Outcome</th>
              {showScore && <th className="px-5 py-2.5 font-medium">Score</th>}
            </tr>
          </thead>
          <tbody>
            {progress.matches.map((match) => (
              <tr key={match.matchId} className="border-t border-zinc-100">
                <td className="px-5 py-3 text-zinc-900">{match.moduleName}</td>
                <td className="px-5 py-3 whitespace-nowrap text-zinc-700">{match.sessionDate}</td>
                <td className="px-5 py-3 text-zinc-800">{match.topic}</td>
                <td className="px-5 py-3 capitalize text-zinc-800">{match.outcome}</td>
                {showScore && <td className="px-5 py-3 text-zinc-800">{match.scoreLabel ?? ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
