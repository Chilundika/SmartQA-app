"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";
import { loadStudentProfile, lookupStudentAccount } from "@/lib/auth/student";
import { studentSyntheticEmail } from "@/lib/auth/studentEmail";
import { signOutSession } from "@/lib/auth/session";
import { logSupabaseError } from "@/lib/db/errors";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring-2";

export default function StudentLoginScreen() {
  const router = useRouter();
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const number = studentNumber.trim();
    const email = studentSyntheticEmail(number);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      logSupabaseError("student.signInWithPassword", signInError, { studentNumber: number });
      const lookup = await lookupStudentAccount(number);
      setSubmitting(false);
      if (!lookup.ok) {
        setError(lookup.error);
        return;
      }
      setError(
        lookup.hasAccount
          ? "Wrong password. Try again."
          : "No account found for this Student Number — contact your lecturer.",
      );
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setSubmitting(false);
      setError("Sign-in did not return a user. Try again.");
      return;
    }

    const profile = await loadStudentProfile(userId);
    if (!profile.ok) {
      await signOutSession();
      setSubmitting(false);
      setError(profile.error);
      return;
    }

    if (profile.profile.mustChangePassword) {
      router.replace("/student/change-password");
      router.refresh();
      return;
    }

    router.replace("/student");
    router.refresh();
  }

  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Student</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Sign in</h1>
            <p className="mt-1 text-sm text-zinc-600">Use your Student Number and password. You do not need an email address.</p>
          </div>
          <ThemeToggle />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700">Student Number</span>
            <input
              type="text"
              name="student-number"
              autoComplete="username"
              inputMode="text"
              required
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 w-full items-center justify-center text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
          >
            Back to sign-in choices
          </Link>
        </form>
      </main>
    </div>
  );
}
