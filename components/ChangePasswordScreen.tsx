"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { clearMustChangePassword, loadAdminProfile } from "@/lib/auth/admin";
import { logSupabaseError } from "@/lib/db/errors";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const inputClass =
  "min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring-2";

const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [forced, setForced] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data, error: userError }) => {
      if (cancelled) return;
      if (userError) {
        logSupabaseError("auth.getUser", userError);
        setError("Could not load your session. Sign in again.");
        setForced(true);
        return;
      }
      const userId = data.user?.id;
      if (!userId) {
        setForced(true);
        return;
      }
      const profile = await loadAdminProfile(userId);
      if (cancelled) return;
      if (!profile.ok) {
        setError(profile.error);
        setForced(true);
        return;
      }
      setForced(profile.profile.mustChangePassword);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      if (userError) logSupabaseError("auth.getUser", userError);
      setSubmitting(false);
      setError("Your session expired. Sign in again.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      logSupabaseError("auth.updateUser", updateError);
      setSubmitting(false);
      setError(updateError.message || "Could not update password.");
      return;
    }

    const cleared = await clearMustChangePassword(userData.user.id);
    if (!cleared.ok) {
      setSubmitting(false);
      setError(cleared.error);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Admin</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {forced ? "Create your new password" : "Change password"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {forced
                ? "You must set a new password before using the matching dashboard. This step cannot be skipped."
                : "Choose a new password for your admin account."}
            </p>
          </div>
          <ThemeToggle />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700">New password</span>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700">Confirm password</span>
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            disabled={submitting || forced === null}
            aria-busy={submitting}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {submitting ? "Saving…" : "Save password"}
          </button>
          {forced === false && (
            <Link href="/" className="inline-flex min-h-11 w-full items-center justify-center text-sm font-medium text-zinc-700 underline-offset-2 hover:underline">
              Back to session setup
            </Link>
          )}
        </form>
      </main>
    </div>
  );
}
