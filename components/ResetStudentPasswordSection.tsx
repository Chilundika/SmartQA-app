"use client";

import { useState } from "react";

import {
  confirmStudentPasswordReset,
  lookupStudentForPasswordReset,
} from "@/lib/auth/resetStudentPassword";

const inputClass =
  "min-h-11 w-full max-w-xs rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring-2";

type Pending = { studentNumber: string; fullName: string };

export default function ResetStudentPasswordSection() {
  const [studentNumber, setStudentNumber] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleProceed(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const number = studentNumber.trim();
    if (!number) {
      setError("Enter a Student Number.");
      setSuccess(null);
      setPending(null);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setPending(null);
    try {
      const result = await lookupStudentForPasswordReset(number);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPending(result.student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look up this Student Number.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (busy || !pending) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await confirmStudentPasswordReset(pending.studentNumber);
      if (!result.ok || !("reset" in result) || !result.reset) {
        setError(result.ok ? "The reset request did not complete." : result.error);
        return;
      }
      setSuccess(`Password reset. ${result.student.fullName} will be prompted to set a new password on next login.`);
      setPending(null);
      setStudentNumber("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset this password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12 border-t border-zinc-200 pt-8">
      <h2 className="text-lg font-semibold">Reset Student Password</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Set a student&apos;s password back to the default. They will have to choose a new password the next time they
        sign in.
      </p>

      <form onSubmit={(e) => void handleProceed(e)} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-zinc-700">Student Number</span>
          <input
            type="text"
            name="reset-student-number"
            value={studentNumber}
            onChange={(e) => {
              setStudentNumber(e.target.value);
              setPending(null);
              setSuccess(null);
            }}
            className={inputClass}
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={busy || pending !== null}
          className="inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {busy && !pending ? "Looking up…" : "Proceed Reset"}
        </button>
      </form>

      {pending && (
        <div className="mt-4 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-950">
            Are you sure you want to reset the password for {pending.fullName}, {pending.studentNumber}?
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-300"
            >
              {busy ? "Resetting…" : "Confirm reset"}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={busy}
              className="inline-flex min-h-11 items-center text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>
      )}
    </section>
  );
}
