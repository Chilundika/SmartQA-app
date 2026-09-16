type DbError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
  name?: string;
};

export function toPlainSupabaseError(error: unknown): DbError {
  if (error && typeof error === "object") {
    const e = error as DbError;
    return {
      name: e.name,
      message: e.message,
      code: e.code,
      details: e.details,
      hint: e.hint,
      status: e.status,
    };
  }
  return { message: String(error) };
}

export function logSupabaseError(scope: string, error: unknown, extra?: Record<string, unknown>): void {
  console.error(`[SmartQA] ${scope}`, toPlainSupabaseError(error), extra ?? "");
}

export function formatDbError(prefix: string, error: DbError): string {
  const msg = `${error.code ?? ""} ${error.message || "Unknown error"}`;
  if (/could not find the table|relation .* does not exist/i.test(msg)) {
    return `${prefix} required tables are missing. Run supabase/phase1.sql in the Supabase SQL Editor.`;
  }
  if (/schema cache|column .*state|42703/i.test(msg)) {
    return `${prefix} the sessions table is missing the state column. Run supabase/phase1.sql in the Supabase SQL Editor.`;
  }
  if (/row-level security|permission denied|42501|401/i.test(msg)) {
    return `${prefix} the database blocked this write. Run supabase/phase1.sql in the Supabase SQL Editor (Phase 1 policies).`;
  }
  return `${prefix} ${error.message || "Unknown error"}`;
}
