export function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login" || pathname === "/student/login") return true;
  return /^\/session\/[^/]+\/public\/?$/.test(pathname);
}

export function isStudentAppPath(pathname: string): boolean {
  return pathname === "/student" || pathname.startsWith("/student/");
}

export function isAdminApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/admin/");
}

export function isPublicApiPath(pathname: string): boolean {
  return pathname === "/api/student/account-status";
}
