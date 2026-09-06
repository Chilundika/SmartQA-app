import type { ParseQuestionsResult } from "@/lib/parseQuestions";
import PreviewIssues, { StatPill } from "./PreviewIssues";

export default function QuestionPreviewTable({ result }: { result: ParseQuestionsResult }) {
  const { validRows, skippedRows, duplicates, warnings, extraColumns, blankRowsIgnored } = result;
  const topics = new Set(validRows.map((q) => q.topic));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatPill tone={validRows.length > 0 ? "good" : "bad"}>{validRows.length} questions parsed</StatPill>
        {topics.size > 0 && <StatPill>{topics.size} topic{topics.size === 1 ? "" : "s"}</StatPill>}
        {skippedRows.length > 0 && <StatPill tone="warn">{skippedRows.length} skipped</StatPill>}
        {duplicates.length > 0 && <StatPill tone="bad">{duplicates.length} duplicate ID{duplicates.length === 1 ? "" : "s"}</StatPill>}
        {warnings.length > 0 && <StatPill tone="warn">{warnings.length} warning{warnings.length === 1 ? "" : "s"}</StatPill>}
        {blankRowsIgnored > 0 && <StatPill>{blankRowsIgnored} blank row{blankRowsIgnored === 1 ? "" : "s"} ignored</StatPill>}
      </div>

      <PreviewIssues keyColumn="question_id" skippedRows={skippedRows} duplicates={duplicates} warnings={warnings} />

      {validRows.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-md border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Topic</th>
                <th className="px-3 py-2 font-medium">Question</th>
                {extraColumns.map((col) => (
                  <th key={col} className="px-3 py-2 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {validRows.map((q) => (
                <tr key={q.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-zinc-800">{q.questionId}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-zinc-800">{q.topic}</td>
                  <td className="px-3 py-1.5 text-zinc-800">{q.questionText}</td>
                  {extraColumns.map((col) => (
                    <td key={col} className="whitespace-nowrap px-3 py-1.5 text-zinc-600">
                      {q.extra[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
