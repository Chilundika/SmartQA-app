"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import FileUploader from "@/components/FileUploader";
import StudentPreviewTable from "@/components/StudentPreviewTable";
import QuestionPreviewTable from "@/components/QuestionPreviewTable";
import RollCallLists from "@/components/RollCallLists";
import SoundToggle from "@/components/SoundToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { applyConfirmedCountdownToAllSessions, readGlobalCountdownSeconds } from "@/lib/countdown";
import { parseMaxScoreInput } from "@/lib/score";
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
  const [listsOpen, setListsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [countdownEnabled, setCountdownEnabled] = useState(true);
  const [countdownDraft, setCountdownDraft] = useState("2");
  const [countdownConfirmedMinutes, setCountdownConfirmedMinutes] = useState<number | null>(null);
  const [countdownError, setCountdownError] = useState<string | null>(null);
  const [countdownAppliedCount, setCountdownAppliedCount] = useState<number | null>(null);
  const [absentIds, setAbsentIds] = useState<Set<string>>(() => new Set());
  const [maxScoreDraft, setMaxScoreDraft] = useState("");
  const [maxScoreError, setMaxScoreError] = useState<string | null>(null);
  // Synchronous lock so a second click/Enter in the same tick cannot mint another session.
  const startingRef = useRef(false);

  const date = dateOverride ?? (mounted ? todayLocalIso() : "");
  const savedSessions = useMemo<SessionSummary[]>(
    () => (mounted ? listSessions() : []),
    // sessionsVersion is bumped after deletes so the list re-reads localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, sessionsVersion],
  );

  useEffect(() => {
    if (!mounted) return;
    const seconds = readGlobalCountdownSeconds();
    if (seconds === null || seconds <= 0) return;
    const minutes = Math.max(1, Math.round(seconds / 60));
    setCountdownEnabled(true);
    setCountdownDraft(String(minutes));
    setCountdownConfirmedMinutes(minutes);
  }, [mounted]);

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
  const countdownReady = !countdownEnabled || countdownConfirmedMinutes !== null;
  const canStart = bothConfirmed && moduleName.trim().length > 0 && date.length > 0 && countdownReady;

  function handleStart() {
    if (startingRef.current) return;
    if (students.status !== "confirmed" || questions.status !== "confirmed") return;

    if (students.result.validRows.every((s) => absentIds.has(s.id))) {
      setStartError("Every student is marked absent. Uncheck at least one to start.");
      return;
    }

    if (countdownEnabled && countdownConfirmedMinutes === null) {
      setStartError("Confirm the countdown minutes before starting.");
      return;
    }

    const maxScoreParsed = parseMaxScoreInput(maxScoreDraft);
    if (maxScoreParsed === "invalid") {
      setMaxScoreError("Enter a whole number from 1 to 100, or leave blank to disable scoring.");
      return;
    }

    startingRef.current = true;
    setStarting(true);
    setStartError(null);

    const session: Session = {
      sessionId: crypto.randomUUID(),
      moduleName: moduleName.trim(),
      dateCreated: date,
      students: students.result.validRows.map((s) =>
        absentIds.has(s.id) ? { ...s, status: "skipped" as const } : s,
      ),
      questions: questions.result.validRows,
      matches: [],
      currentMatch: null,
      countdownSeconds: countdownEnabled ? (countdownConfirmedMinutes ?? 2) * 60 : 0,
      ...(maxScoreParsed !== null ? { maxScore: maxScoreParsed } : {}),
    };

    const saved = saveSession(session);
    if (!saved.ok) {
      startingRef.current = false;
      setStarting(false);
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
    <div className={`flex-1 bg-zinc-50 text-zinc-900 ${listsOpen ? "print:hidden" : ""}`}>
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Random Student–Question Matcher</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Set up a session by naming the module and loading your students and question bank.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <ThemeToggle />
          </div>
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
            <div className="mt-4 max-w-xs">
              <Field label="Max score" htmlFor="max-score">
                <input
                  id="max-score"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  step={1}
                  value={maxScoreDraft}
                  onChange={(e) => {
                    setMaxScoreDraft(e.target.value);
                    setMaxScoreError(null);
                  }}
                  placeholder="Leave blank to disable"
                  className={inputClass}
                />
              </Field>
              <p className="mt-1 text-xs text-zinc-500">
                Sets the top mark for every question (e.g. 20). Leave blank if you are not scoring this session.
              </p>
              {maxScoreError && (
                <p role="alert" className="mt-1 text-sm text-red-700">
                  {maxScoreError}
                </p>
              )}
            </div>
            <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
              <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={countdownEnabled}
                  onChange={(e) => {
                    setCountdownEnabled(e.target.checked);
                    setCountdownError(null);
                  }}
                  className="h-5 w-5"
                />
                Countdown per question
              </label>

              {countdownEnabled && countdownConfirmedMinutes !== null ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm text-emerald-900">
                    <span className="font-medium">
                      {countdownConfirmedMinutes} minute{countdownConfirmedMinutes === 1 ? "" : "s"} confirmed
                    </span>
                    <span className="text-emerald-700"> for each question</span>
                    {countdownAppliedCount !== null && countdownAppliedCount > 0 && (
                      <span className="text-emerald-700">
                        {" "}
                        · applied to {countdownAppliedCount} saved session
                        {countdownAppliedCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCountdownDraft(String(countdownConfirmedMinutes));
                      setCountdownConfirmedMinutes(null);
                      setCountdownAppliedCount(null);
                      setCountdownError(null);
                    }}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : countdownEnabled ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Minutes per question" htmlFor="countdown-minutes">
                      <input
                        id="countdown-minutes"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={60}
                        step={1}
                        value={countdownDraft}
                        onChange={(e) => {
                          setCountdownDraft(e.target.value);
                          setCountdownError(null);
                        }}
                        placeholder="e.g. 2"
                        className={`${inputClass} w-28`}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => {
                        const minutes = parseCountdownMinutes(countdownDraft);
                        if (minutes === null) {
                          setCountdownError("Enter a whole number of minutes between 1 and 60.");
                          return;
                        }
                        setCountdownError(null);
                        setCountdownConfirmedMinutes(minutes);
                        setCountdownDraft(String(minutes));
                        const applied = applyConfirmedCountdownToAllSessions(minutes * 60);
                        setCountdownAppliedCount(applied);
                      }}
                      className="inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      Confirm countdown
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Type the minutes you want, then confirm. That duration is used for every question, including in
                    sessions already saved on this device. It does not auto-advance.
                  </p>
                  {countdownError && (
                    <p role="alert" className="text-sm text-red-700">
                      {countdownError}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No per-question countdown will run in this session.</p>
              )}
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
              onReset={() => {
                setStudents({ status: "idle" });
                setAbsentIds(new Set());
              }}
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
                ? absentIds.size > 0
                  ? `Everything is loaded. ${absentIds.size} student${absentIds.size === 1 ? "" : "s"} marked absent will be skipped.`
                  : "Everything is loaded. You can start the session."
                : countdownEnabled && countdownConfirmedMinutes === null && bothConfirmed && moduleName.trim().length > 0
                  ? "Confirm the countdown minutes to start."
                  : "Enter a module name and confirm both files to start."}
            </p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              {bothConfirmed && (
                <button
                  type="button"
                  onClick={() => setListsOpen(true)}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 sm:w-auto"
                >
                  View Full Lists / Mark absent
                </button>
              )}
              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart || starting}
                aria-busy={starting}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-auto"
              >
                {starting ? "Starting…" : "Start Session"}
              </button>
            </div>
          </div>
          {startError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {startError}
            </p>
          )}
        </div>

        {/* Previous sessions */}
        <section className="mt-12 border-t border-zinc-200 pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Load previous session</h2>
            <Link
              href={moduleName.trim() ? `/stats?module=${encodeURIComponent(moduleName.trim())}` : "/stats"}
              className="inline-flex min-h-11 items-center text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              Module stats
            </Link>
          </div>
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
                      className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-50"
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
      {listsOpen && bothConfirmed && (
        <RollCallLists
          moduleName={moduleName.trim() || "Untitled session"}
          dateLabel={date}
          students={students.result.validRows}
          questions={questions.result.validRows}
          onClose={() => setListsOpen(false)}
          excludeMode
          excludedIds={absentIds}
          onToggleExcluded={(id) => {
            setAbsentIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
        />
      )}
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

function parseCountdownMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 60) return null;
  return n;
}

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
        <button type="button" onClick={onReset} className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-800 underline-offset-2 hover:underline">
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
              className="inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {confirmLabel(state.result)}
            </button>
            <button type="button" onClick={onReset} className="inline-flex min-h-11 items-center text-sm font-medium text-zinc-600 hover:text-zinc-900">
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
