import { NextResponse, type NextRequest } from "next/server";

import { createMiddlewareClient, withCookies } from "@/lib/supabase/middleware";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  return /^\/session\/[^/]+\/public\/?$/.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = await createMiddlewareClient(request);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;

  if (userError && userError.name !== "AuthSessionMissingError") {
    console.error("[SmartQA] middleware getUser", {
      message: userError.message,
      status: userError.status,
      name: userError.name,
    });
  }

  const { pathname, search } = request.nextUrl;

  if (!user) {
    if (isPublicPath(pathname)) return response;
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    const next = `${pathname}${search}`;
    if (next && next !== "/") login.searchParams.set("next", next);
    return withCookies(response, NextResponse.redirect(login));
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
    if (pathname === "/login") return response;
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("error", "not_admin");
    return withCookies(response, NextResponse.redirect(login));
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
    if (pathname === "/change-password") return response;
    const change = request.nextUrl.clone();
    change.pathname = "/change-password";
    change.search = "";
    return withCookies(response, NextResponse.redirect(change));
  }

  if (pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return withCookies(response, NextResponse.redirect(home));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
