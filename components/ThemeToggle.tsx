"use client";

import { useState } from "react";
import { persistTheme, readTheme, THEMES, type Theme } from "@/lib/theme";
import { useMounted } from "@/lib/useMounted";

export default function ThemeToggle() {
  const mounted = useMounted();
  const [, setRev] = useState(0);
  const theme = mounted ? readTheme() : "light";

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500 print:hidden">
      <span className="sr-only">Display mode</span>
      <select
        value={theme}
        onChange={(e) => {
          persistTheme(e.target.value as Theme);
          setRev((n) => n + 1);
        }}
        className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
