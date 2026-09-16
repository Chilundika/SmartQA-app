"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { isSafeNextPath, loadAdminProfile, signOutAdmin } from "@/lib/auth/admin";
import { logSupabaseError } from "@/lib/db/errors";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const inputClass =
  "min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring-2";

export default function AdminLoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "not_admin" ? "This account is not an admin." : null,
  );

  useEffect(() => {
    if (searchParams.get("error") !== "not_admin") return;
    void signOutAdmin();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      logSupabaseError("auth.signInWithPassword", signInError);
      setSubmitting(false);
      setError("Email or password is incorrect.");
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setSubmitting(false);
      setError("Sign-in did not return a user. Try again.");
      return;
    }

    const profile = await loadAdminProfile(userId);
    if (!profile.ok) {
      await signOutAdmin();
      setSubmitting(false);
      setError(profile.error);
      return;
    }

    if (profile.profile.mustChangePassword) {
      router.replace("/change-password");
      router.refresh();
      return;
    }

    const next = searchParams.get("next");
    router.replace(isSafeNextPath(next) ? next : "/");
    router.refresh();
  }

  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Admin</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Sign in</h1>
            <p className="mt-1 text-sm text-zinc-600">Use your admin email and password to open the matching dashboard.</p>
          </div>
          <ThemeToggle />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
        </form>
      </main>
    </div>
  );
}
