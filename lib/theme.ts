export const THEME_KEY = "rsm_theme";
export type Theme = "light" | "dark" | "contrast";

export const THEMES: { id: Theme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "contrast", label: "High contrast" },
];

export function readTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "dark" || raw === "contrast" || raw === "light") return raw;
  } catch {
    /* private mode */
  }
  return "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark" || theme === "contrast");
  root.classList.toggle("theme-contrast", theme === "contrast");
}

export function persistTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* quota / private mode — the class still applies for this visit */
  }
}
