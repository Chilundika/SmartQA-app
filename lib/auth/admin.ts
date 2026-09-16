import { createClient } from "../supabase/client.ts";
import { formatDbError, logSupabaseError } from "../db/errors.ts";

export type AdminProfile = {
  id: string;
  email: string;
  mustChangePassword: boolean;
};

export function isSafeNextPath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login");
}

export async function loadAdminProfile(userId: string): Promise<
  { ok: true; profile: AdminProfile } | { ok: false; error: string }
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admins")
    .select("id, email, must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (!error && data) {
    return {
      ok: true,
      profile: {
        id: data.id as string,
        email: data.email as string,
        mustChangePassword: Boolean(data.must_change_password),
      },
    };
  }
  if (error) logSupabaseError("admins.select", error, { userId });

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) logSupabaseError("rpc.is_admin", adminError, { userId });
  if (!isAdmin) {
    return { ok: false, error: error ? formatDbError("Could not load admin profile:", error) : "This account is not an admin." };
  }

  const { data: mustChange, error: flagError } = await supabase.rpc("admin_must_change_password");
  if (flagError) logSupabaseError("rpc.admin_must_change_password", flagError, { userId });

  const { data: userData } = await supabase.auth.getUser();
  return {
    ok: true,
    profile: {
      id: userId,
      email: (userData.user?.email as string | undefined) ?? "",
      mustChangePassword: Boolean(mustChange),
    },
  };
}

export async function clearMustChangePassword(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("admins")
    .update({ must_change_password: false })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    logSupabaseError("admins.update must_change_password", error, { userId });
    return { ok: false, error: formatDbError("Could not update admin profile:", error) };
  }
  if (!data?.id) {
    console.error("[SmartQA] admins.update returned no row", { userId });
    return {
      ok: false,
      error: "Could not clear the must-change-password flag. Check RLS policies on public.admins.",
    };
  }
  return { ok: true };
}

export async function signOutAdmin(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) logSupabaseError("auth.signOut", error);
}
