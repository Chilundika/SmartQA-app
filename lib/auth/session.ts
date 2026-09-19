import { isRetryableNetworkError, isStaleAuthError } from "./sessionErrors.ts";
import { logSupabaseError } from "../db/errors.ts";
import { createClient } from "../supabase/client.ts";

export async function signOutSession(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (!error || isStaleAuthError(error)) return;
  if (isRetryableNetworkError(error)) {
    await supabase.auth.signOut({ scope: "local" });
    return;
  }
  logSupabaseError("auth.signOut", error);
}
