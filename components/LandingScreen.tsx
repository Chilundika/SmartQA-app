import Link from "next/link";

import ThemeToggle from "@/components/ThemeToggle";

const cardClass =
  "flex min-h-28 flex-col items-start justify-center rounded-lg border border-zinc-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50";

export default function LandingScreen() {
  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900">
      <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">SmartQA Sort</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Choose how to sign in</h1>
            <p className="mt-1 text-sm text-zinc-600">Admins run matching sessions. Students view their own portal.</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid gap-3">
          <Link href="/login" className={cardClass}>
            <span className="text-base font-semibold text-zinc-900">Admin Login</span>
            <span className="mt-1 text-sm text-zinc-600">Sign in with your admin email to open the matching dashboard.</span>
          </Link>
          <Link href="/student/login" className={cardClass}>
            <span className="text-base font-semibold text-zinc-900">Student Login</span>
            <span className="mt-1 text-sm text-zinc-600">Sign in with your Student Number and password.</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
