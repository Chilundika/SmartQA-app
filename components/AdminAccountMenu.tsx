"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { signOutAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/client";

export default function AdminAccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const hide = pathname === "/login" || /\/session\/[^/]+\/public\/?$/.test(pathname);

  useEffect(() => {
    if (hide) return;
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [hide]);

  if (hide || !email) return null;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOutAdmin();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
      <p className="hidden truncate text-xs text-zinc-500 sm:block" title={email}>
        {email}
      </p>
      <Link
        href="/change-password"
        className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Change password
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-400"
      >
        {signingOut ? "Signing out…" : "Log out"}
      </button>
    </div>
  );
}
