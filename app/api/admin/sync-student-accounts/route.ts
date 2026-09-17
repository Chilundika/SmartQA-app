import { NextResponse } from "next/server";

import { isStaleAuthError, suppressStaleAuthConsole } from "@/lib/auth/sessionErrors";
import { studentSyntheticEmail } from "@/lib/auth/studentEmail";
import { logSupabaseError } from "@/lib/db/errors";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RosterInput = {
  studentNumber?: unknown;
  student_number?: unknown;
  fullName?: unknown;
  full_name?: unknown;
};

type Body = {
  students?: RosterInput[];
};

type Failure = { studentNumber: string; error: string };

function isExistingAuthUserError(error: { message?: string; code?: string }): boolean {
  const msg = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return /already been registered|already exists|email_exists|user_already_exists/.test(msg);
}

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; status: number; error: string }
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
    logSupabaseError("sync-student-accounts.getUser", userError);
  }
  if (!user) return { ok: false, status: 401, error: "Sign in as an admin to sync student accounts." };

  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (adminError) logSupabaseError("sync-student-accounts.admins.select", adminError, { userId: user.id });
  if (adminRow?.id) return { ok: true };

  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
  if (rpcError) logSupabaseError("sync-student-accounts.is_admin", rpcError, { userId: user.id });
  if (isAdmin) return { ok: true };

  return { ok: false, status: 403, error: "Only admins can sync student accounts." };
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createServiceRoleClient>,
  email: string,
): Promise<string | null> {
  const want = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      logSupabaseError("auth.admin.listUsers", error, { page });
      return null;
    }
    const users = data.users ?? [];
    const found = users.find((u) => u.email?.toLowerCase() === want);
    if (found) return found.id;
    if (users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD;
  if (!defaultPassword) {
    return NextResponse.json(
      { ok: false, error: "DEFAULT_STUDENT_PASSWORD is not set on the server." },
      { status: 500 },
    );
  }

  let body: Body = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (err) {
    logSupabaseError("createServiceRoleClient", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Service role client is not configured." },
      { status: 500 },
    );
  }

  const roster = Array.isArray(body.students) ? body.students : [];
  const toUpsert = roster
    .map((row) => {
      const student_number = String(row.studentNumber ?? row.student_number ?? "").trim();
      const full_name = String(row.fullName ?? row.full_name ?? "").trim() || student_number;
      return {
        student_number,
        full_name,
        must_change_password: true,
      };
    })
    .filter((row) => row.student_number);

  if (toUpsert.length > 0) {
    const unique = [...new Map(toUpsert.map((r) => [r.student_number, r])).values()];
    const { error: upsertError } = await admin.from("students").upsert(unique, {
      onConflict: "student_number",
      ignoreDuplicates: true,
    });
    if (upsertError) {
      logSupabaseError("sync-student-accounts.students.upsert", upsertError, { count: unique.length });
      return NextResponse.json(
        { ok: false, error: `Could not save roster rows: ${upsertError.message}` },
        { status: 500 },
      );
    }
  }

  const { data: rows, error: listError } = await admin
    .from("students")
    .select("student_number, full_name, auth_user_id");

  if (listError) {
    logSupabaseError("sync-student-accounts.students.select", listError);
    return NextResponse.json(
      {
        ok: false,
        error: `Could not read students: ${listError.message}${listError.code ? ` (code ${listError.code})` : ""}`,
      },
      { status: 500 },
    );
  }

  let created = 0;
  let skipped = 0;
  let linked = 0;
  const failed: Failure[] = [];

  for (const row of rows ?? []) {
    const studentNumber = String(row.student_number ?? "").trim();
    if (!studentNumber) continue;
    if (row.auth_user_id) {
      skipped += 1;
      continue;
    }

    const email = studentSyntheticEmail(studentNumber);
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        student_number: studentNumber,
        full_name: row.full_name,
      },
    });

    let userId = createdUser.user?.id ?? null;
    let newlyCreated = Boolean(userId);

    if (createError) {
      if (isExistingAuthUserError(createError)) {
        userId = await findUserIdByEmail(admin, email);
        newlyCreated = false;
        if (!userId) {
          logSupabaseError("auth.admin.createUser (exists, lookup failed)", createError, { studentNumber });
          failed.push({
            studentNumber,
            error: "An Auth user already exists for this student number, but it could not be linked.",
          });
          continue;
        }
      } else {
        logSupabaseError("auth.admin.createUser", createError, { studentNumber });
        failed.push({ studentNumber, error: createError.message });
        continue;
      }
    }

    if (!userId) {
      failed.push({ studentNumber, error: "Auth user was not returned after create." });
      continue;
    }

    const update: { auth_user_id: string; must_change_password?: boolean } = { auth_user_id: userId };
    if (newlyCreated) update.must_change_password = true;

    const { data: updated, error: updateError } = await admin
      .from("students")
      .update(update)
      .eq("student_number", studentNumber)
      .is("auth_user_id", null)
      .select("student_number")
      .maybeSingle();

    if (updateError) {
      logSupabaseError("sync-student-accounts.students.update", updateError, { studentNumber });
      failed.push({ studentNumber, error: updateError.message });
      continue;
    }
    if (!updated) {
      skipped += 1;
      continue;
    }
    if (newlyCreated) created += 1;
    else linked += 1;
  }

  return NextResponse.json({ ok: true, created, skipped, linked, failed });
}
