import "server-only";
import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "./env.ts";

/**
 * Service-role client. Import only from Route Handlers / other server-only modules.
 * Never import this file from a client component — the key bypasses RLS.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  return createClient(supabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
