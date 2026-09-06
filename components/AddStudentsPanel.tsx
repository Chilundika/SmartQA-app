"use client";

import { useState } from "react";

import FileUploader from "./FileUploader";
import StudentPreviewTable from "./StudentPreviewTable";
import { parseStudents, type ParseStudentsResult } from "@/lib/parseStudents";
import type { Student } from "@/types";

type State =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "error"; fileName: string; message: string }
  | { status: "preview"; fileName: string; result: ParseStudentsResult };

type Props = {
  existingNumbers: ReadonlySet<string>;
  onAdd: (students: Student[]) => void;
};

/**
 * Mid-session student merge (PRD §7). New rows join the pending pool;
 * existing student_numbers are skipped so completed matches stay untouched.
 * The confirm step is required — preview alone does not merge.
 */
export default function AddStudentsPanel({ existingNumbers, onAdd }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleFile(file: File) {
    setState({ status: "parsing", fileName: file.name });
    try {
      const result = await parseStudents(file);
      setState({ status: "preview", fileName: file.name, result });
    } catch (err) {
      setState({
        status: "error",
        fileName: file.name,
        message: err instanceof Error ? err.message : "Could not read this file.",
      });
    }
  }

  const fileName = state.status === "idle" ? undefined : state.fileName;

  let preview: { fresh: Student[]; conflicts: Student[]; result: ParseStudentsResult } | null = null;
  if (state.status === "preview") {
    const fresh: Student[] = [];
    const conflicts: Student[] = [];
    for (const s of state.result.validRows) (existingNumbers.has(s.studentNumber) ? conflicts : fresh).push(s);
    preview = { fresh, conflicts, result: { ...state.result, validRows: fresh } };
  }

  const canAdd = preview !== null && preview.fresh.length > 0 && preview.result.duplicates.length === 0;

  return (
    <div className="space-y-4">
      <FileUploader
        label="Upload more students"
        fileName={fileName}
        busy={state.status === "parsing"}
        onFileSelected={handleFile}
      />

      {state.status === "error" && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      )}

      {preview && (
        <>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">This will not affect already-completed matches.</p>
            <p className="mt-1">
              New students will be merged into the pending pool. Confirm below to apply the change.
            </p>
          </div>

          {preview.conflicts.length > 0 && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="font-medium">
                {preview.conflicts.length} student{preview.conflicts.length === 1 ? "" : "s"} already in this session
                will be left unchanged:
              </p>
              <p className="mt-1 font-mono text-xs">{preview.conflicts.map((s) => s.studentNumber).join(", ")}</p>
            </div>
          )}

          <StudentPreviewTable result={preview.result} />

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => {
                if (!preview || !canAdd) return;
                onAdd(preview.fresh);
                setState({ status: "idle" });
              }}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              Confirm & add {preview.fresh.length} student{preview.fresh.length === 1 ? "" : "s"}
            </button>
            <button
              type="button"
              onClick={() => setState({ status: "idle" })}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            {!canAdd && (
              <span className="text-xs text-zinc-500">
                {preview.fresh.length === 0
                  ? "Nothing new to add — every student in this file is already in the session."
                  : "Resolve the duplicate numbers above, then upload the corrected file."}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
