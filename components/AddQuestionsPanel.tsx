"use client";

import { useState } from "react";

import FileUploader from "./FileUploader";
import QuestionPreviewTable from "./QuestionPreviewTable";
import { parseQuestions, type ParsedQuestion, type ParseQuestionsResult } from "@/lib/parseQuestions";

type State =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "error"; fileName: string; message: string }
  | { status: "preview"; fileName: string; result: ParseQuestionsResult };

type Props = {
  /** question_id values already in the session; incoming rows with these IDs are rejected. */
  existingIds: ReadonlySet<string>;
  onAdd: (questions: ParsedQuestion[]) => void;
};

export default function AddQuestionsPanel({ existingIds, onAdd }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function handleFile(file: File) {
    setState({ status: "parsing", fileName: file.name });
    try {
      const result = await parseQuestions(file);
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

  let preview: { fresh: ParsedQuestion[]; conflicts: ParsedQuestion[]; result: ParseQuestionsResult } | null = null;
  if (state.status === "preview") {
    const fresh: ParsedQuestion[] = [];
    const conflicts: ParsedQuestion[] = [];
    for (const q of state.result.validRows) (existingIds.has(q.questionId) ? conflicts : fresh).push(q);
    preview = { fresh, conflicts, result: { ...state.result, validRows: fresh } };
  }

  const canAdd = preview !== null && preview.fresh.length > 0 && preview.result.duplicates.length === 0;

  return (
    <div className="space-y-4">
      <FileUploader
        label="Upload more questions"
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
          {preview.conflicts.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">
                {preview.conflicts.length} question{preview.conflicts.length === 1 ? "" : "s"} already exist in this
                session and will not be added:
              </p>
              <p className="mt-1 font-mono text-xs">{preview.conflicts.map((q) => q.questionId).join(", ")}</p>
            </div>
          )}

          <QuestionPreviewTable result={preview.result} />

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
              Add {preview.fresh.length} new question{preview.fresh.length === 1 ? "" : "s"}
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
                  ? "Nothing new to add — every question in this file is already in the session."
                  : "Resolve the duplicate IDs above, then upload the corrected file."}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
