"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FileUploader from "@/components/FileUploader";
import StudentPreviewTable from "@/components/StudentPreviewTable";
import QuestionPreviewTable from "@/components/QuestionPreviewTable";
import { parseStudents, type ParseStudentsResult } from "@/lib/parseStudents";
import { parseQuestions, type ParseQuestionsResult } from "@/lib/parseQuestions";
import { deleteSession, listSessions, saveSession, type SessionSummary } from "@/lib/sessionStorage";
import { useMounted } from "@/lib/useMounted";
import type { Session } from "@/types";

type UploadState<R> =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "error"; fileName: string; message: string }
  | { status: "preview"; fileName: string; result: R }
  | { status: "confirmed"; fileName: string; result: R };

function todayLocalIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function SessionSetupPage() {
  const router = useRouter();
  const mounted = useMounted();

  const [moduleName, setModuleName] = useState("");
  // null = "not edited yet", so the auto-filled default can come from the browser's local clock.
  const [dateOverride, setDate] = useState<string | null>(null);
  const [students, setStudents] = useState<UploadState<ParseStudentsResult>>({ status: "idle" });
  const [questions, setQuestions] = useState<UploadState<ParseQuestionsResult>>({ status: "idle" });
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);

  const date = dateOverride ?? (mounted ? todayLocalIso() : "");
  const savedSessions = useMemo<SessionSummary[]>(
    () => (mounted ? listSessions() : []),
    // sessionsVersion is bumped after deletes so the list re-reads localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, sessionsVersion],
  );

  async function handleUpload<R>(
    file: File,
    parse: (file: File) => Promise<R>,
    setState: (s: UploadState<R>) => void,
  ) {
    setState({ status: "parsing", fileName: file.name });
    try {
      const result = await parse(file);
      setState({ status: "preview", fileName: file.name, result });
    } catch (err) {
      setState({
        status: "error",
        fileName: file.name,
        message: err instanceof Error ? err.message : "Could not read this file.",
      });
    }
  }

  const bothConfirmed = students.status === "confirmed" && questions.status === "confirmed";
  const canStart = bothConfirmed && moduleName.trim().length > 0 && date.length > 0;

  function handleStart() {
    if (students.status !== "confirmed" || questions.status !== "confirmed") return;
    setStartError(null);

    const session: Session = {
      sessionId: crypto.randomUUID(),
      moduleName: moduleName.trim(),
      dateCreated: date,
      students: students.result.validRows,
      questions: questions.result.validRows,
      matches: [],
      currentMatch: null,
    };

    const saved = saveSession(session);
    if (!saved.ok) {
      setStartError(saved.error);
      return;
    }
    router.push(`/session/${session.sessionId}`);
  }

  function handleDelete(summary: SessionSummary) {
    if (!window.confirm(`Delete the saved session "${summary.moduleName}"? This cannot be undone.`)) return;
    deleteSession(summary.sessionId);
    setSessionsVersion((v) => v + 1);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Random Student–Question Matcher</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Set up a session by naming the module and loading your students and question bank.
          </p>
        </header>

        <div className="space-y-6">
          {/* Step 1: session details */}
          <Card step={1} title="Session details">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="Module name" htmlFor="module-name">
                <input
                  id="module-name"
                  type="text"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="e.g. CS201 Data Structures — Oral Exam"
                  className={inputClass}
                />
              </Field>
              <Field label="Date" htmlFor="session-date">
                <input
                  id="session-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </Card>

          {/* Step 2: students */}
          <Card
            step={2}
            title="Students"
            description="Columns required: student_number, full_name"
            status={students.status}
          >
            <UploadPanel
              state={students}
              uploaderLabel="Choose students file"
              onFile={(file) => handleUpload(file, parseStudents, setStudents)}
              onConfirm={() =>
                students.status === "preview" && setStudents({ ...students, status: "confirmed" })
              }
              onReset={() => setStudents({ status: "idle" })}
              confirmLabel={(r) => `Confirm & Load ${r.validRows.length} students`}
              canConfirm={(r) => r.validRows.length > 0 && r.duplicates.length === 0}
              confirmedSummary={(r) => `${r.validRows.length} students loaded`}
              renderPreview={(r) => <StudentPreviewTable result={r} />}
            />
          </Card>

          {/* Step 3: questions */}
          <Card
            step={3}
            title="Questions"
            description="Columns required: question_id, topic, question_text (extra columns are kept)"
            status={questions.status}
          >
            <UploadPanel
              state={questions}
              uploaderLabel="Choose questions file"
              onFile={(file) => handleUpload(file, parseQuestions, setQuestions)}
              onConfirm={() =>
                questions.status === "preview" && setQuestions({ ...questions, status: "confirmed" })
              }
              onReset={() => setQuestions({ status: "idle" })}
              confirmLabel={(r) => `Confirm & Load ${r.validRows.length} questions`}
              canConfirm={(r) => r.validRows.length > 0 && r.duplicates.length === 0}
              confirmedSummary={(r) => `${r.validRows.length} questions loaded`}
              renderPreview={(r) => <QuestionPreviewTable result={r} />}
            />
          </Card>

          {/* Start */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600">
              {canStart
                ? "Everything is loaded. You can start the session."
                : "Enter a module name and confirm both files to start."}
            </p>
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              Start Session
            </button>
          </div>
          {startError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {startError}
            </p>
          )}
        </div>

        {/* Previous sessions */}
        <section className="mt-12 border-t border-zinc-200 pt-8">
          <h2 className="text-lg font-semibold">Load previous session</h2>
          {savedSessions.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No saved sessions on this device yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
              {savedSessions.map((s) => (
                <li key={s.sessionId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.moduleName || "Untitled session"}</p>
                    <p className="text-xs text-zinc-500">
                      Session date {s.dateCreated} · last saved {formatSavedAt(s.savedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/session/${s.sessionId}`)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      className="rounded-md px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function Card({
  step,
  title,
  description,
  status,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  status?: UploadState<unknown>["status"];
  children: React.ReactNode;
}) {
  const done = status === "confirmed";
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              done ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white"
            }`}
            aria-hidden
          >
            {done ? "✓" : step}
          </span>
          <div>
            <h2 className="font-semibold">{title}</h2>
            {description && <p className="text-xs text-zinc-500">{description}</p>}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function UploadPanel<R>({
  state,
  uploaderLabel,
  onFile,
  onConfirm,
  onReset,
  confirmLabel,
  canConfirm,
  confirmedSummary,
  renderPreview,
}: {
  state: UploadState<R>;
  uploaderLabel: string;
  onFile: (file: File) => void;
  onConfirm: () => void;
  onReset: () => void;
  confirmLabel: (result: R) => string;
  canConfirm: (result: R) => boolean;
  confirmedSummary: (result: R) => string;
  renderPreview: (result: R) => React.ReactNode;
}) {
  if (state.status === "confirmed") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm text-emerald-900">
          <span className="font-medium">{confirmedSummary(state.result)}</span>
          <span className="text-emerald-700"> from {state.fileName}</span>
        </p>
        <button type="button" onClick={onReset} className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline">
          Replace file
        </button>
      </div>
    );
  }

  const fileName = state.status === "idle" ? undefined : state.fileName;

  return (
    <div className="space-y-4">
      <FileUploader label={uploaderLabel} fileName={fileName} busy={state.status === "parsing"} onFileSelected={onFile} />

      {state.status === "error" && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      )}

      {state.status === "preview" && (
        <>
          {renderPreview(state.result)}
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canConfirm(state.result)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {confirmLabel(state.result)}
            </button>
            <button type="button" onClick={onReset} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Cancel
            </button>
            {!canConfirm(state.result) && (
              <span className="text-xs text-zinc-500">Resolve the issues above, then upload the corrected file.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
