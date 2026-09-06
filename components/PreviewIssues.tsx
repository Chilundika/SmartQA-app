import type { DuplicateGroup, RowWarning, SkippedRow } from "@/lib/parseFile";

type Props = {
  /** Column name shown in the duplicate message, e.g. "student_number". */
  keyColumn: string;
  skippedRows: SkippedRow[];
  duplicates: DuplicateGroup[];
  warnings?: RowWarning[];
};

export function StatPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "bg-zinc-100 text-zinc-700",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-800",
    bad: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export default function PreviewIssues({ keyColumn, skippedRows, duplicates, warnings = [] }: Props) {
  if (skippedRows.length === 0 && duplicates.length === 0 && warnings.length === 0) return null;

  return (
    <div className="space-y-3 text-sm">
      {duplicates.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
          <p className="font-medium">
            Duplicate {keyColumn} values found. Fix the file and upload it again before loading.
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {duplicates.map((d) => (
              <li key={d.value}>
                <code className="rounded bg-red-100 px-1 font-mono text-xs">{d.value}</code> appears on rows{" "}
                {d.rows.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {skippedRows.length > 0 && (
        <details className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <summary className="cursor-pointer font-medium">
            {skippedRows.length} row{skippedRows.length === 1 ? "" : "s"} skipped due to missing data — see details
          </summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {skippedRows.map((s) => (
              <li key={s.rowNumber}>
                Row {s.rowNumber}: {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {warnings.length > 0 && (
        <details className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-zinc-700">
          <summary className="cursor-pointer font-medium">
            {warnings.length} warning{warnings.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {warnings.map((w, i) => (
              <li key={`${w.rowNumber}-${i}`}>
                Row {w.rowNumber}: {w.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
