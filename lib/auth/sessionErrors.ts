type AuthErrorLike = { name?: string; message?: string; code?: string; details?: string } | null | undefined;

export function isStaleAuthError(error: AuthErrorLike): boolean {
  if (!error) return false;
  if (error.name === "AuthSessionMissingError") return true;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    code === "refresh_token_not_found" ||
    code === "session_not_found" ||
    /invalid refresh token|refresh token not found|session from session_id claim in jwt does not exist/i.test(
      message,
    )
  );
}

/** Transient network failure talking to Supabase (timeouts, DNS, offline). Not an auth/credential error. */
export function isRetryableNetworkError(error: AuthErrorLike): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  const blob = `${error.name ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.code ?? ""}`;
  return /fetch failed|failed to fetch|connect.?timeout|UND_ERR_CONNECT_TIMEOUT|AuthRetryableFetchError/i.test(
    blob,
  );
}

function isStaleAuthLogArg(arg: unknown): boolean {
  if (typeof arg === "string") {
    return /invalid refresh token|refresh token not found|auth session missing/i.test(arg);
  }
  if (arg && typeof arg === "object") {
    return isStaleAuthError(arg as { name?: string; message?: string; code?: string });
  }
  return false;
}

/** Supabase Auth logs AuthApiError itself while probing for a session; mute only that expected miss. */
export function suppressStaleAuthConsole(): () => void {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (args.some(isStaleAuthLogArg)) return;
    original.apply(console, args);
  };
  return () => {
    console.error = original;
  };
}
