export type StudentAccountSyncFailure = {
  studentNumber: string;
  error: string;
};

export type StudentAccountSyncResult = {
  ok: true;
  created: number;
  skipped: number;
  linked: number;
  failed: StudentAccountSyncFailure[];
};

export type StudentAccountSyncResponse =
  | StudentAccountSyncResult
  | { ok: false; error: string };

export type RosterStudent = {
  studentNumber: string;
  fullName: string;
};

export async function requestStudentAccountSync(
  roster?: RosterStudent[],
): Promise<StudentAccountSyncResponse> {
  const response = await fetch("/api/admin/sync-student-accounts", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(roster && roster.length > 0 ? { students: roster } : {}),
  });

  const json: unknown = await response.json().catch(() => null);
  if (json && typeof json === "object" && "ok" in json) {
    return json as StudentAccountSyncResponse;
  }
  return {
    ok: false,
    error: `Could not sync student accounts (HTTP ${response.status}).`,
  };
}

export function formatStudentAccountSync(result: StudentAccountSyncResult): string {
  const parts = [
    `${result.created} created`,
    `${result.skipped} already linked`,
    ...(result.linked > 0 ? [`${result.linked} linked to existing Auth users`] : []),
  ];
  if (result.failed.length > 0) parts.push(`${result.failed.length} failed`);
  return `Student accounts: ${parts.join(", ")}.`;
}
