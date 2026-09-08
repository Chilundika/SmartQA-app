"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ExportButtons from "./ExportButtons";
import ScoreLeaderboard from "./ScoreLeaderboard";
import StudentHistoryDialog from "./StudentHistoryDialog";
import ThemeToggle from "./ThemeToggle";
import { formatMatchTime, sessionToSummaryRows } from "@/lib/exportCsv";
import { deleteSession, loadSession } from "@/lib/sessionStorage";
import { useMounted } from "@/lib/useMounted";

export default function SummaryScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const mounted = useMounted();
  const session = useMemo(() => (mounted ? loadSession(sessionId) : undefined), [mounted, sessionId]);
  const [historyStudent, setHistoryStudent] = useState<{
    studentNumber: string;
    fullName: string;
  } | null>(null);

  if (session === undefined) {
    return (
      <Shell>
        <p className="text-sm text-zinc-500">Loading session…</p>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-zinc-900">Session not found</h1>
          <p className="mt-1 text-sm text-zinc-600">
            No saved session with ID <code className="font-mono text-xs">{sessionId}</code> exists on this device.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-zinc-900 underline underline-offset-2">
            Back to session setup
          </Link>
        </div>
      </Shell>
    );
  }

  const rows = sessionToSummaryRows(session);
  const completed = session.matches.filter((m) => m.outcome === "completed").length;
  const skipped = session.matches.filter((m) => m.outcome === "skipped").length;
  const hasScores = session.matches.some((m) => typeof m.score === "number");
  const matchingHref = `/session/${session.sessionId}`;

  function handleStartNew() {
    deleteSession(sessionId);
    router.push("/");
  }

  return (
    <Shell>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Session summary</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{session.moduleName}</h1>
          <p className="mt-0.5 text-sm text-zinc-600">{session.dateCreated}</p>
          <p className="mt-2 text-sm text-zinc-600">
            {session.matches.length === 0
              ? "No matches recorded yet."
              : `${completed} completed${skipped > 0 ? ` · ${skipped} skipped` : ""}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <ThemeToggle />
          <Link
            href={matchingHref}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Back to matching
          </Link>
          <Link
            href={`/session/${session.sessionId}/public`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Student view
          </Link>
          <ExportButtons session={session} />
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Print
          </button>
          <button
            type="button"
            onClick={handleStartNew}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
          >
            Start New Session
          </button>
        </div>
      </header>

      <ScoreLeaderboard matches={session.matches} />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
          No completed or skipped matches yet. Return to matching to begin.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Question</th>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                {hasScores && <th className="px-4 py-3 font-medium">Score</th>}
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {session.matches.map((m) => (
                <tr key={m.matchId} className="align-top">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setHistoryStudent({
                          studentNumber: m.student.studentNumber,
                          fullName: m.student.fullName,
                        })
                      }
                      className="text-left font-medium text-zinc-900 underline-offset-2 hover:underline print:hidden"
                    >
                      {m.student.fullName}
                    </button>
                    <p className="hidden font-medium text-zinc-900 print:block">{m.student.fullName}</p>
                    <p className="font-mono text-xs text-zinc-500">{m.student.studentNumber}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-zinc-900">{m.question.questionText}</p>
                    <p className="font-mono text-xs text-zinc-500">{m.question.questionId}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-800">{m.question.topic}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.outcome === "completed"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {m.outcome === "completed" ? "Completed" : "Skipped"}
                    </span>
                  </td>
                  {hasScores && (
                    <td className="px-4 py-3 tabular-nums text-zinc-800">
                      {typeof m.score === "number" ? m.score : "—"}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    {formatMatchTime(m.completedAt ?? m.matchedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {historyStudent && (
        <StudentHistoryDialog
          moduleName={session.moduleName}
          studentNumber={historyStudent.studentNumber}
          studentName={historyStudent.fullName}
          onClose={() => setHistoryStudent(null)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
