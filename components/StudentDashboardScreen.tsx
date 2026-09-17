"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";
import { loadStudentProfile, type StudentProfile } from "@/lib/auth/student";
import { signOutSession } from "@/lib/auth/session";
import { logSupabaseError } from "@/lib/db/errors";
import { createClient } from "@/lib/supabase/client";

export default function StudentDashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
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
      const loaded = await loadStudentProfile(userId);
      if (cancelled) return;
      if (!loaded.ok) {
        setError(loaded.error);
        return;
      }
      setProfile(loaded.profile);
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

  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Student</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          {!error && !profile && <p className="text-sm text-zinc-600">Loading…</p>}
          {profile && (
            <p className="text-lg font-medium text-zinc-900">Welcome, {profile.fullName}</p>
          )}
          <p className="text-sm text-zinc-600">Your match history will appear here in a later update.</p>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-400"
          >
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </main>
    </div>
  );
}
