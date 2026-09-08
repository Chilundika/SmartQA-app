"use client";

import { useId, type ChangeEvent } from "react";

type Props = {
  label: string;
  fileName?: string;
  busy?: boolean;
  onFileSelected: (file: File) => void;
};

const ACCEPT = [
  ".csv",
  ".xlsx",
  ".xls",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

export default function FileUploader({ label, fileName, busy = false, onFileSelected }: Props) {
  const inputId = useId();

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear so choosing the same file again (after fixing it) still fires onChange.
    e.target.value = "";
    if (file) onFileSelected(file);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label
        htmlFor={inputId}
        className={`inline-flex min-h-11 cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 ${
          busy ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={busy}
        onChange={handleChange}
      />
      <span className="text-sm text-zinc-500">
        {busy ? "Parsing…" : fileName ?? "No file selected (.csv or .xlsx)"}
      </span>
    </div>
  );
}
