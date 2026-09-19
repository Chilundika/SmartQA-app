import { NextResponse } from "next/server";

import { isStaleAuthError, suppressStaleAuthConsole } from "@/lib/auth/sessionErrors";
import { logSupabaseError } from "@/lib/db/errors";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  studentNumber?: unknown;
  confirm?: unknown;
};

async function requireAdmin(): Promise<
  { ok: true; adminId: string } | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const restoreConsole = suppressStaleAuthConsole();
  let user = null;
  let userError: { name?: string; message?: string; code?: string; status?: number } | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    userError = result.error;
  } finally {
    restoreConsole();
  }
  if (userError && !isStaleAuthError(userError)) {
    logSupabaseError("reset-student-password.getUser", userError);
  }
  if (!user) return { ok: false, status: 401, error: "Sign in as an admin to reset a student password." };

  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (adminError) logSupabaseError("reset-student-password.admins.select", adminError, { userId: user.id });
  if (adminRow?.id) return { ok: true, adminId: String(adminRow.id) };

  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
  if (rpcError) logSupabaseError("reset-student-password.is_admin", rpcError, { userId: user.id });
  if (isAdmin) {
    return {
      ok: false,
      status: 403,
      error: "This account is an admin but has no row in public.admins, so the reset cannot be audited.",
    };
  }

  return { ok: false, status: 403, error: "Only admins can reset a student password." };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: Body = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }

  const studentNumber = String(body.studentNumber ?? "").trim();
  if (!studentNumber) {
    return NextResponse.json({ ok: false, error: "Student Number is required." }, { status: 400 });
  }

  const confirm = body.confirm === true;

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (err) {
    logSupabaseError("reset-student-password createServiceRoleClient", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Service role client is not configured." },
      { status: 500 },
    );
  }

  const { data: student, error: lookupError } = await admin
    .from("students")
    .select("student_number, full_name, auth_user_id")
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (lookupError) {
    logSupabaseError("reset-student-password.students.select", lookupError, { studentNumber });
    return NextResponse.json(
      { ok: false, error: `Could not look up this Student Number: ${lookupError.message}` },
      { status: 500 },
    );
  }
  if (!student?.student_number) {
    return NextResponse.json({ ok: false, error: "No student found with that number" }, { status: 404 });
  }

  const fullName = String(student.full_name ?? student.student_number);
  const authUserId = student.auth_user_id ? String(student.auth_user_id) : "";

  if (!confirm) {
    if (!authUserId) {
      return NextResponse.json(
        {
          ok: false,
          error: "This student does not have a login account yet. Sync student accounts first.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      student: { studentNumber: student.student_number, fullName },
    });
  }

  if (!authUserId) {
    return NextResponse.json(
      {
        ok: false,
        error: "This student does not have a login account yet. Sync student accounts first.",
      },
      { status: 400 },
    );
  }

  const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD;
  if (!defaultPassword) {
    return NextResponse.json(
      { ok: false, error: "DEFAULT_STUDENT_PASSWORD is not set on the server." },
      { status: 500 },
    );
  }

  const { error: authError } = await admin.auth.admin.updateUserById(authUserId, {
    password: defaultPassword,
  });
  if (authError) {
    logSupabaseError("reset-student-password.auth.updateUserById", authError, { studentNumber });
    return NextResponse.json(
      { ok: false, error: `Could not reset the Auth password: ${authError.message}` },
      { status: 500 },
    );
  }

  const { data: updated, error: flagError } = await admin
    .from("students")
    .update({ must_change_password: true })
    .eq("student_number", student.student_number)
    .select("student_number")
    .maybeSingle();
  if (flagError) {
    logSupabaseError("reset-student-password.students.update", flagError, { studentNumber });
    return NextResponse.json(
      { ok: false, error: `Could not set must_change_password: ${flagError.message}` },
      { status: 500 },
    );
  }
  if (!updated?.student_number) {
    console.error("[SmartQA] reset-student-password.students.update returned no row", { studentNumber });
    return NextResponse.json(
      { ok: false, error: "Password was reset in Auth, but the students row was not updated." },
      { status: 500 },
    );
  }

  const { data: audit, error: auditError } = await admin
    .from("password_resets")
    .insert({
      admin_id: auth.adminId,
      student_number: student.student_number,
    })
    .select("id")
    .maybeSingle();
  if (auditError) {
    logSupabaseError("reset-student-password.password_resets.insert", auditError, {
      studentNumber,
      adminId: auth.adminId,
    });
    return NextResponse.json(
      {
        ok: false,
        error: `Password was reset, but the audit log could not be written: ${auditError.message}`,
      },
      { status: 500 },
    );
  }
  if (!audit?.id) {
    console.error("[SmartQA] reset-student-password.password_resets.insert returned no row", { studentNumber });
    return NextResponse.json(
      { ok: false, error: "Password was reset, but the audit log did not return a password_resets row." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    reset: true,
    student: { studentNumber: student.student_number, fullName },
  });
}
