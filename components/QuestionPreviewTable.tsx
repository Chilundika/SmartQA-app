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
        <>
          <ul className="max-h-72 space-y-2 overflow-auto md:hidden">
            {validRows.map((q) => (
              <li key={q.id} className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-zinc-500">{q.questionId}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {q.topic}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-zinc-900">{q.questionText}</p>
                {extraColumns.length > 0 && (
                  <dl className="mt-2 space-y-0.5 text-xs text-zinc-600">
                    {extraColumns.map((col) =>
                      q.extra[col] ? (
                        <div key={col}>
                          <dt className="inline font-medium">{col}: </dt>
                          <dd className="inline">{q.extra[col]}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden max-h-72 overflow-auto rounded-md border border-zinc-200 md:block">
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
        </>
      )}
    </div>
  );
}
