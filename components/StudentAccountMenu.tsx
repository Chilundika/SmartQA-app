"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { signOutSession } from "@/lib/auth/session";

export default function StudentAccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const show = pathname === "/student" || pathname === "/student/change-password";

  if (!show) return null;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOutSession();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-400"
      >
        {signingOut ? "Signing out…" : "Log out"}
      </button>
    </div>
  );
}
