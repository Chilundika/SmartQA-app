/** The JS client wants the project origin, not the PostgREST path some dashboards copy. */
export function supabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return raw.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

export function supabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function assertSupabaseEnv(): { url: string; key: string } | { error: string } {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) {
    return {
      error:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    };
  }
  return { url, key };
}
