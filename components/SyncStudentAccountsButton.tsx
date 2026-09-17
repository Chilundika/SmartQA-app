"use client";

import { useState } from "react";

import {
  formatStudentAccountSync,
  requestStudentAccountSync,
  type StudentAccountSyncResponse,
} from "@/lib/auth/syncStudentAccounts";

export default function SyncStudentAccountsButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StudentAccountSyncResponse | null>(null);

  async function handleSync() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const next = await requestStudentAccountSync();
      setResult(next);
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Could not sync student accounts.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-full flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleSync()}
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-400"
      >
        {busy ? "Syncing…" : "Sync student accounts"}
      </button>
      {result && (
        <p
          role={result.ok && result.failed.length === 0 ? undefined : "alert"}
          className={`max-w-xs text-right text-xs ${
            result.ok && result.failed.length === 0 ? "text-zinc-500" : "text-red-700"
          }`}
        >
          {result.ok
            ? formatStudentAccountSync(result)
            : result.error}
        </p>
      )}
    </div>
  );
}
