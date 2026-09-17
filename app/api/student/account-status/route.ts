import { NextResponse } from "next/server";

import { logSupabaseError } from "@/lib/db/errors";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  studentNumber?: unknown;
};

export async function POST(request: Request) {
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

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (err) {
    logSupabaseError("student.account-status createServiceRoleClient", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Service role client is not configured." },
      { status: 500 },
    );
  }

  const { data, error } = await admin
    .from("students")
    .select("auth_user_id")
    .eq("student_number", studentNumber)
    .maybeSingle();

  if (error) {
    logSupabaseError("student.account-status students.select", error, { studentNumber });
    return NextResponse.json(
      { ok: false, error: `Could not check this Student Number: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, hasAccount: Boolean(data?.auth_user_id) });
}
