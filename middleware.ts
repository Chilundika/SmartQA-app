import { NextResponse, type NextRequest } from "next/server";

import {
  clearSupabaseAuthCookies,
  createMiddlewareClient,
  hasSupabaseAuthCookie,
  isStaleAuthError,
  suppressStaleAuthConsole,
  withCookies,
} from "@/lib/supabase/middleware";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  return /^\/session\/[^/]+\/public\/?$/.test(pathname);
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

  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!user) {
    if (isPublicPath(pathname)) return getResponse();
    if (isApi) {
      return withCookies(
        getResponse(),
        NextResponse.json({ ok: false, error: "Sign in as an admin to continue." }, { status: 401 }),
      );
    }
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    const next = `${pathname}${search}`;
    if (next && next !== "/") login.searchParams.set("next", next);
    return withCookies(getResponse(), NextResponse.redirect(login));
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

  if (!isAdmin) {
    if (isApi) {
      return withCookies(
        getResponse(),
        NextResponse.json({ ok: false, error: "Only admins can call this endpoint." }, { status: 403 }),
      );
    }
    if (pathname === "/login") return getResponse();
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("error", "not_admin");
    return withCookies(getResponse(), NextResponse.redirect(login));
  }

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
    const change = request.nextUrl.clone();
    change.pathname = "/change-password";
    change.search = "";
    return withCookies(getResponse(), NextResponse.redirect(change));
  }

  if (pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return withCookies(getResponse(), NextResponse.redirect(home));
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
