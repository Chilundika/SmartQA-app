import { redirect } from "next/navigation";

import LandingScreen from "@/components/LandingScreen";
import SessionSetupPage from "@/components/SessionSetupScreen";
import { isRetryableNetworkError, isStaleAuthError, suppressStaleAuthConsole } from "@/lib/auth/sessionErrors";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().some((cookie) => cookie.name.startsWith("sb-"));
  if (!hasAuthCookie) return <LandingScreen />;

  const supabase = await createClient();
  const restoreConsole = suppressStaleAuthConsole();
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    if (result.error && isRetryableNetworkError(result.error)) {
      console.warn("[SmartQA] home getUser: Supabase unreachable", {
        message: result.error.message,
        name: result.error.name,
      });
      return <LandingScreen />;
    }
    if (result.error && !isStaleAuthError(result.error)) {
      console.error("[SmartQA] home getUser", {
        message: result.error.message,
        status: result.error.status,
        name: result.error.name,
      });
    }
  } finally {
    restoreConsole();
  }

  if (!user) return <LandingScreen />;

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin) return <SessionSetupPage />;
  redirect("/student");
}
