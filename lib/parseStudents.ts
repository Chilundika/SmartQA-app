import type { Student } from "../types/index.ts";
import {
  findDuplicates,
  isBlankRow,
  readTabularFile,
  resolveColumns,
  type DuplicateGroup,
  type SkippedRow,
} from "./parseFile.ts";

export const STUDENT_COLUMNS = ["student_number", "full_name"] as const;

export type ParseStudentsResult = {
  /** Students ready to load. Only the first occurrence of a duplicated student_number is included. */
  validRows: Student[];
  /** Rows with missing data. Fully blank rows are dropped silently and not listed here. */
  skippedRows: SkippedRow[];
  /**
   * student_number values that appear more than once, with every row number
   * involved. Per PRD §4 the upload should be rejected while this is non-empty.
   */
  duplicates: DuplicateGroup[];
  /** Number of completely empty rows that were ignored. */
  blankRowsIgnored: number;
};

type Candidate = { rowNumber: number; student: Student };

/**
 * Parses a students upload (.csv or .xlsx) per PRD §4.
 * Throws `FileFormatError` if the file type is unsupported or a required column is missing.
 */
export async function parseStudents(file: File): Promise<ParseStudentsResult> {
  const { headers, rows } = await readTabularFile(file);
  const col = resolveColumns(headers, [...STUDENT_COLUMNS]);

  const candidates: Candidate[] = [];
  const skippedRows: SkippedRow[] = [];
  let blankRowsIgnored = 0;

  for (const { rowNumber, cells } of rows) {
    if (isBlankRow(cells)) {
      blankRowsIgnored++;
      continue;
    }

    const studentNumber = cells[col.student_number] ?? "";
    const fullName = cells[col.full_name] ?? "";

    const missing: string[] = [];
    if (!studentNumber) missing.push("student_number");
    if (!fullName) missing.push("full_name");
    if (missing.length > 0) {
      skippedRows.push({ rowNumber, reason: `Missing ${missing.join(" and ")}`, raw: cells });
      continue;
    }

    candidates.push({
      rowNumber,
      student: {
        id: crypto.randomUUID(),
        studentNumber,
        fullName,
        status: "pending",
      },
    });
  }

  const { unique, duplicates } = findDuplicates(
    candidates,
    (c) => c.student.studentNumber,
    (c) => c.rowNumber,
  );

  return {
    validRows: unique.map((c) => c.student),
    skippedRows,
    duplicates,
    blankRowsIgnored,
  };
}
