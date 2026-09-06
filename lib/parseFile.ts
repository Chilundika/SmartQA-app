import Papa from "papaparse";
import * as XLSX from "xlsx";

/** One data row from the upload, keyed by the header text exactly as it appeared in the file. */
export type RawRow = {
  /** 1-based row number as the lecturer would see it in Excel (header is row 1). */
  rowNumber: number;
  cells: Record<string, string>;
};

export type TabularFile = {
  headers: string[];
  rows: RawRow[];
};

export type SkippedRow = {
  rowNumber: number;
  reason: string;
  raw: Record<string, string>;
};

export type DuplicateGroup = {
  /** The repeated key value (e.g. a student_number or question_id). */
  value: string;
  /** Every row number where this value appeared, in file order. */
  rows: number[];
};

export type RowWarning = {
  rowNumber: number;
  message: string;
};

/** Whole-file failure: wrong file type, unreadable, or required columns missing. */
export class FileFormatError extends Error {
  readonly details: { missingColumns?: string[]; foundColumns?: string[] };

  constructor(message: string, details: { missingColumns?: string[]; foundColumns?: string[] } = {}) {
    super(message);
    this.name = "FileFormatError";
    this.details = details;
  }
}

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

/**
 * Case-insensitive lookup of required column names. Returns a map from
 * normalized required name -> actual header in the file, or throws listing
 * what was missing so the UI can show a specific mismatch message.
 */
export function resolveColumns(headers: string[], required: string[]): Record<string, string> {
  const byNormalized = new Map<string, string>();
  for (const h of headers) {
    const key = normalizeHeader(h);
    if (key && !byNormalized.has(key)) byNormalized.set(key, h);
  }

  const resolved: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of required) {
    const actual = byNormalized.get(normalizeHeader(name));
    if (actual === undefined) missing.push(name);
    else resolved[name] = actual;
  }

  if (missing.length > 0) {
    throw new FileFormatError(
      `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. ` +
        `Found: ${headers.filter(Boolean).join(", ") || "(no headers)"}.`,
      { missingColumns: missing, foundColumns: headers },
    );
  }
  return resolved;
}

export function isBlankRow(cells: Record<string, string>): boolean {
  return Object.values(cells).every((v) => v.trim() === "");
}

function fileExtension(file: File): string {
  const dot = file.name.lastIndexOf(".");
  return dot === -1 ? "" : file.name.slice(dot + 1).toLowerCase();
}

function toRows(matrix: string[][]): TabularFile {
  const [headerRow = [], ...dataRows] = matrix;
  const headers = headerRow.map((h) => String(h ?? "").trim());

  const rows: RawRow[] = dataRows.map((values, i) => {
    const cells: Record<string, string> = {};
    headers.forEach((header, col) => {
      if (header === "") return;
      cells[header] = String(values[col] ?? "").trim();
    });
    return { rowNumber: i + 2, cells };
  });

  return { headers, rows };
}

async function readCsv(file: File): Promise<TabularFile> {
  const text = await file.text();
  // Parse without headers and without skipping empty lines so that the array
  // index maps directly onto the line number the lecturer sees in the file.
  const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false });
  // FieldMismatch (ragged rows) and Delimiter (auto-detect fell back to ",") are
  // recoverable; only malformed quoting means the data can't be trusted.
  const fatal = result.errors.filter((e) => e.type === "Quotes");
  if (fatal.length > 0) {
    throw new FileFormatError(`Could not parse CSV: ${fatal[0].message}`);
  }
  return toRows(result.data);
}

async function readXlsx(file: File): Promise<TabularFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new FileFormatError("The workbook contains no sheets.");

  const sheet = workbook.Sheets[firstSheetName];
  // raw:false returns display strings so numeric student numbers keep leading
  // zeros / formatting instead of coming back as JS numbers.
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });
  return toRows(matrix);
}

/** Reads a `.csv` or `.xlsx` upload into headers + rows. Does no validation beyond file type. */
export async function readTabularFile(file: File): Promise<TabularFile> {
  const ext = fileExtension(file);
  if (ext === "csv") return readCsv(file);
  if (ext === "xlsx" || ext === "xls") return readXlsx(file);
  throw new FileFormatError(
    `Unsupported file type "${ext ? `.${ext}` : file.name}". Please upload a .csv or .xlsx file.`,
  );
}

/**
 * Splits rows into unique-first-occurrences and duplicate groups by a key.
 * The first row for each key is kept; every key that appears more than once is
 * reported with all of its row numbers so the lecturer can find them.
 */
export function findDuplicates<T>(
  items: T[],
  getKey: (item: T) => string,
  getRowNumber: (item: T) => number,
): { unique: T[]; duplicates: DuplicateGroup[] } {
  const rowsByKey = new Map<string, number[]>();
  for (const item of items) {
    const key = getKey(item);
    const rows = rowsByKey.get(key);
    if (rows) rows.push(getRowNumber(item));
    else rowsByKey.set(key, [getRowNumber(item)]);
  }

  const duplicateKeys = new Set(
    [...rowsByKey.entries()].filter(([, rows]) => rows.length > 1).map(([key]) => key),
  );
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const duplicates: DuplicateGroup[] = [...rowsByKey.entries()]
    .filter(([key]) => duplicateKeys.has(key))
    .map(([value, rows]) => ({ value, rows }));

  return { unique, duplicates };
}
