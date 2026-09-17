import { NextResponse, type NextRequest } from "next/server";

import { isAdminApiPath, isPublicApiPath, isPublicPath, isStudentAppPath } from "@/lib/auth/paths";
import {
  clearSupabaseAuthCookies,
  createMiddlewareClient,
  hasSupabaseAuthCookie,
  isStaleAuthError,
  suppressStaleAuthConsole,
  withCookies,
} from "@/lib/supabase/middleware";

function redirectTo(request: NextRequest, response: NextResponse, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return withCookies(response, NextResponse.redirect(url));
}

async function studentMustChangePassword(
  supabase: Awaited<ReturnType<typeof createMiddlewareClient>>["supabase"],
  userId: string,
): Promise<boolean> {
  const { data: flag, error: flagError } = await supabase.rpc("student_must_change_password");
  if (!flagError) return Boolean(flag);

  console.error("[SmartQA] middleware student_must_change_password", {
    message: flagError.message,
    code: flagError.code,
    details: flagError.details,
    hint: flagError.hint,
  });

  const { data: row, error: rowError } = await supabase
    .from("students")
    .select("must_change_password")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (rowError) {
    console.error("[SmartQA] middleware students.must_change_password", {
      message: rowError.message,
      code: rowError.code,
      details: rowError.details,
      hint: rowError.hint,
    });
  }
  return Boolean(row?.must_change_password);
}

export async function middleware(request: NextRequest) {
  const { supabase, getResponse } = await createMiddlewareClient(request);
  let user = null;

  if (hasSupabaseAuthCookie(request)) {
    const restoreConsole = suppressStaleAuthConsole();
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      user = userData.user;

      if (userError && isStaleAuthError(userError)) {
        user = null;
        clearSupabaseAuthCookies(request, getResponse());
      } else if (userError) {
        console.error("[SmartQA] middleware getUser", {
          message: userError.message,
          status: userError.status,
          name: userError.name,
          code: "code" in userError ? userError.code : undefined,
        });
      }
    } finally {
      restoreConsole();
    }
  }

  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!user) {
    if (isPublicPath(pathname) || isPublicApiPath(pathname)) return getResponse();
    if (isApi) {
      const message = isAdminApiPath(pathname)
        ? "Sign in as an admin to continue."
        : "Sign in to continue.";
      return withCookies(getResponse(), NextResponse.json({ ok: false, error: message }, { status: 401 }));
    }
    return redirectTo(request, getResponse(), "/");
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    console.error("[SmartQA] middleware is_admin", {
      message: adminError.message,
      code: adminError.code,
      details: adminError.details,
      hint: adminError.hint,
    });
  }

  if (isAdmin) {
    const { data: mustChange, error: flagError } = await supabase.rpc("admin_must_change_password");
    if (flagError) {
      console.error("[SmartQA] middleware admin_must_change_password", {
        message: flagError.message,
        code: flagError.code,
        details: flagError.details,
        hint: flagError.hint,
      });
    }

    if (mustChange) {
      if (isApi) {
        return withCookies(
          getResponse(),
          NextResponse.json({ ok: false, error: "Change your password before using admin tools." }, { status: 403 }),
        );
      }
      if (pathname === "/change-password") return getResponse();
      return redirectTo(request, getResponse(), "/change-password");
    }

    if (pathname === "/login" || pathname === "/student/login" || isStudentAppPath(pathname)) {
      return redirectTo(request, getResponse(), "/");
    }
    return getResponse();
  }

  if (isApi) {
    if (isAdminApiPath(pathname)) {
      return withCookies(
        getResponse(),
        NextResponse.json({ ok: false, error: "Only admins can call this endpoint." }, { status: 403 }),
      );
    }
    return getResponse();
  }

  const mustChange = await studentMustChangePassword(supabase, user.id);
  if (mustChange) {
    if (pathname === "/student/change-password") return getResponse();
    return redirectTo(request, getResponse(), "/student/change-password");
  }

  if (pathname === "/login" || pathname === "/student/login" || pathname === "/") {
    return redirectTo(request, getResponse(), "/student");
  }

  if (!isStudentAppPath(pathname)) {
    return redirectTo(request, getResponse(), "/student");
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
