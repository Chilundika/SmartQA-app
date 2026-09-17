import { formatDbError, logSupabaseError } from "../db/errors.ts";
import { createClient } from "../supabase/client.ts";

export type StudentProfile = {
  studentNumber: string;
  fullName: string;
  authUserId: string;
  mustChangePassword: boolean;
};

export async function loadStudentProfile(userId: string): Promise<
  { ok: true; profile: StudentProfile } | { ok: false; error: string }
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("students")
    .select("student_number, full_name, auth_user_id, must_change_password")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) {
    logSupabaseError("students.select self", error, { userId });
    return { ok: false, error: formatDbError("Could not load student profile:", error) };
  }
  if (!data?.student_number) {
    return { ok: false, error: "No student record is linked to this account. Contact your lecturer." };
  }

  return {
    ok: true,
    profile: {
      studentNumber: String(data.student_number),
      fullName: String(data.full_name ?? data.student_number),
      authUserId: String(data.auth_user_id),
      mustChangePassword: Boolean(data.must_change_password),
    },
  };
}

export async function clearStudentMustChangePassword(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("students")
    .update({ must_change_password: false })
    .eq("auth_user_id", userId)
    .select("student_number")
    .maybeSingle();

  if (error) {
    logSupabaseError("students.update must_change_password", error, { userId });
    return { ok: false, error: formatDbError("Could not update student profile:", error) };
  }
  if (!data?.student_number) {
    console.error("[SmartQA] students.update returned no row", { userId });
    return {
      ok: false,
      error: "Could not clear the must-change-password flag. Check RLS policies on public.students.",
    };
  }
  return { ok: true };
}

export async function lookupStudentAccount(studentNumber: string): Promise<
  { ok: true; hasAccount: boolean } | { ok: false; error: string }
> {
  const response = await fetch("/api/student/account-status", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentNumber }),
  });
  const json: unknown = await response.json().catch(() => null);
  if (json && typeof json === "object" && "ok" in json) {
    return json as { ok: true; hasAccount: boolean } | { ok: false; error: string };
  }
  return { ok: false, error: `Could not check this Student Number (HTTP ${response.status}).` };
}
