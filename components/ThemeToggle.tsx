"use client";

import { useState } from "react";
import { persistTheme, readTheme } from "@/lib/theme";
import { useMounted } from "@/lib/useMounted";

export default function ThemeToggle() {
  const mounted = useMounted();
  const [, setRev] = useState(0);
  const theme = mounted ? readTheme() : "light";
  const isDark = theme === "dark" || theme === "contrast";

  return (
    <button
      type="button"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      onClick={() => {
        persistTheme(isDark ? "light" : "dark");
        setRev((n) => n + 1);
      }}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 print:hidden"
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3Z" />
        </svg>
      )}
    </button>
  );
}
