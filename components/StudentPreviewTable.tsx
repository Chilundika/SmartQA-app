import type { ParseStudentsResult } from "@/lib/parseStudents";
import PreviewIssues, { StatPill } from "./PreviewIssues";

export default function StudentPreviewTable({ result }: { result: ParseStudentsResult }) {
  const { validRows, skippedRows, duplicates, blankRowsIgnored } = result;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatPill tone={validRows.length > 0 ? "good" : "bad"}>{validRows.length} students parsed</StatPill>
        {skippedRows.length > 0 && <StatPill tone="warn">{skippedRows.length} skipped</StatPill>}
        {duplicates.length > 0 && <StatPill tone="bad">{duplicates.length} duplicate number{duplicates.length === 1 ? "" : "s"}</StatPill>}
        {blankRowsIgnored > 0 && <StatPill>{blankRowsIgnored} blank row{blankRowsIgnored === 1 ? "" : "s"} ignored</StatPill>}
      </div>

      <PreviewIssues keyColumn="student_number" skippedRows={skippedRows} duplicates={duplicates} />

      {validRows.length > 0 && (
        <>
          <ul className="max-h-64 space-y-2 overflow-auto md:hidden">
            {validRows.map((s, i) => (
              <li key={s.id} className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                <p className="text-xs tabular-nums text-zinc-400">{i + 1}</p>
                <p className="font-medium text-zinc-900">{s.fullName}</p>
                <p className="font-mono text-xs text-zinc-500">{s.studentNumber}</p>
              </li>
            ))}
          </ul>
          <div className="hidden max-h-64 overflow-auto rounded-md border border-zinc-200 md:block">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Student number</th>
                  <th className="px-3 py-2 font-medium">Full name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {validRows.map((s, i) => (
                  <tr key={s.id}>
                    <td className="px-3 py-1.5 text-zinc-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-zinc-800">{s.studentNumber}</td>
                    <td className="px-3 py-1.5 text-zinc-800">{s.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
