import { isStaleAuthError } from "./sessionErrors.ts";
import { logSupabaseError } from "../db/errors.ts";
import { createClient } from "../supabase/client.ts";

export async function signOutSession(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error && !isStaleAuthError(error)) logSupabaseError("auth.signOut", error);
}
