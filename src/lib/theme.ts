/**
 * Theme handling. `localStorage` is used only for this tiny UI setting (allowed
 * by the project rules). The `dark` class on `<html>` is what Tailwind reads.
 *
 * The value stored under `THEME_STORAGE_KEY` is either `"light"` or `"dark"`;
 * when the key is absent the app follows the OS preference ("system"). The
 * inline script in `layout.tsx` applies the same rule before first paint.
 */

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "omivoid-theme";

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** Applies `mode`: toggles the `dark` class and persists the explicit choice. */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }
  if (typeof window !== "undefined") {
    try {
      if (mode === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable (private mode); the class is already applied.
    }
  }
  return resolved;
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === "light") return "dark";
  if (mode === "dark") return "system";
  return "light";
}
