export type ResetStudentLookup = {
  ok: true;
  student: { studentNumber: string; fullName: string };
};

export type ResetStudentDone = ResetStudentLookup & { reset: true };

export type ResetStudentResponse =
  | ResetStudentLookup
  | ResetStudentDone
  | { ok: false; error: string };

async function postReset(body: { studentNumber: string; confirm?: boolean }): Promise<ResetStudentResponse> {
  const response = await fetch("/api/admin/reset-student-password", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => null);
  if (json && typeof json === "object" && "ok" in json) {
    return json as ResetStudentResponse;
  }
  return { ok: false, error: `Could not reset this password (HTTP ${response.status}).` };
}

export function lookupStudentForPasswordReset(studentNumber: string): Promise<ResetStudentResponse> {
  return postReset({ studentNumber });
}

export function confirmStudentPasswordReset(studentNumber: string): Promise<ResetStudentResponse> {
  return postReset({ studentNumber, confirm: true });
}
