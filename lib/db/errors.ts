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
  const message = (error.message || "Unknown error").trim();
  const extras = [error.code ? `code ${error.code}` : null, error.details?.trim(), error.hint?.trim()].filter(
    (part): part is string => Boolean(part),
  );
  const summary = extras.length > 0 ? `${message} (${extras.join("; ")})` : message;
  return `${prefix} ${summary}`.replace(/\s+/g, " ").trim();
}
