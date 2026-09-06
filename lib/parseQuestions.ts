import type { Question } from "../types/index.ts";
import {
  findDuplicates,
  isBlankRow,
  readTabularFile,
  resolveColumns,
  type DuplicateGroup,
  type RowWarning,
  type SkippedRow,
} from "./parseFile.ts";

export const QUESTION_COLUMNS = ["question_id", "topic", "question_text"] as const;

/**
 * A Question plus any extra columns from the upload (e.g. marks, difficulty),
 * keyed by their original header. Structurally still a `Question`, so it can be
 * stored in `Session.questions` unchanged.
 */
export type ParsedQuestion = Question & { extra: Record<string, string> };

export type ParseQuestionsResult = {
  /** Questions ready to load. Only the first occurrence of a duplicated question_id is included. */
  validRows: ParsedQuestion[];
  /** Rows with missing data. Fully blank rows are dropped silently and not listed here. */
  skippedRows: SkippedRow[];
  /**
   * question_id values that appear more than once, with every row number
   * involved. Per PRD §4 the upload should be rejected while this is non-empty.
   */
  duplicates: DuplicateGroup[];
  /** Non-fatal issues, e.g. line breaks inside question_text (normalized to spaces). */
  warnings: RowWarning[];
  /** Headers of any extra, non-required columns found in the file, in file order. */
  extraColumns: string[];
  /** Number of completely empty rows that were ignored. */
  blankRowsIgnored: number;
};

type Candidate = { rowNumber: number; question: ParsedQuestion };

/**
 * Parses a questions upload (.csv or .xlsx) per PRD §4.
 * Throws `FileFormatError` if the file type is unsupported or a required column is missing.
 */
export async function parseQuestions(file: File): Promise<ParseQuestionsResult> {
  const { headers, rows } = await readTabularFile(file);
  const col = resolveColumns(headers, [...QUESTION_COLUMNS]);

  const requiredHeaders = new Set(Object.values(col));
  const extraColumns = headers.filter((h) => h !== "" && !requiredHeaders.has(h));

  const candidates: Candidate[] = [];
  const skippedRows: SkippedRow[] = [];
  const warnings: RowWarning[] = [];
  let blankRowsIgnored = 0;

  for (const { rowNumber, cells } of rows) {
    if (isBlankRow(cells)) {
      blankRowsIgnored++;
      continue;
    }

    const questionId = cells[col.question_id] ?? "";
    const topic = cells[col.topic] ?? "";
    let questionText = cells[col.question_text] ?? "";

    const missing: string[] = [];
    if (!questionId) missing.push("question_id");
    if (!topic) missing.push("topic");
    if (!questionText) missing.push("question_text");
    if (missing.length > 0) {
      skippedRows.push({ rowNumber, reason: `Missing ${missing.join(", ")}`, raw: cells });
      continue;
    }

    if (/[\r\n]/.test(questionText)) {
      warnings.push({
        rowNumber,
        message: `question_text for ${questionId} contains line breaks; they were replaced with spaces.`,
      });
      questionText = questionText.replace(/\s*[\r\n]+\s*/g, " ").trim();
    }

    const extra: Record<string, string> = {};
    for (const header of extraColumns) extra[header] = cells[header] ?? "";

    candidates.push({
      rowNumber,
      question: {
        id: crypto.randomUUID(),
        questionId,
        topic,
        questionText,
        status: "pending",
        extra,
      },
    });
  }

  const { unique, duplicates } = findDuplicates(
    candidates,
    (c) => c.question.questionId,
    (c) => c.rowNumber,
  );

  return {
    validRows: unique.map((c) => c.question),
    skippedRows,
    duplicates,
    warnings,
    extraColumns,
    blankRowsIgnored,
  };
}
