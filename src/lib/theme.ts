import { useCallback, useEffect, useState } from "react";

/**
 * Theme preference.
 *
 * localStorage holds UI preferences only — never forecast data, which lives in
 * IndexedDB.
 *
 * "system" is a real option rather than an initial guess: a visitor whose OS is
 * set to dark expects Runway to follow it, and to keep following it if they
 * change that setting while the app is open.
 */

export type Theme = "light" | "dark" | "system";

/** What the page is actually rendering right now. */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "runway.theme";

export const THEMES: readonly Theme[] = ["light", "system", "dark"];

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // localStorage can be blocked entirely; fall through to the default.
  }
  // Nobody has expressed a preference, so follow the operating system.
  return "system";
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

/**
 * Adds or removes the `dark` class that the Tailwind `@custom-variant` keys off,
 * and repaints the browser's own chrome to match.
 *
 * The `theme-color` meta tag cannot be driven by a media query once a preference
 * is stored: someone on a dark OS who picks light would keep dark browser chrome.
 * Setting it here follows the *resolved* theme rather than the operating system,
 * so the surround always agrees with the page.
 */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle("dark", resolved === "dark");

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta !== null) {
    meta.setAttribute("content", resolved === "dark" ? "#07080b" : "#f7f8fa");
  }
}

export interface ThemeController {
  theme: Theme;
  /** The preference after "system" has been resolved. */
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

export function useTheme(): ThemeController {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark);

  /*
   * Derived, not stored. Holding `resolved` in its own state would mean an
   * effect writing state on every theme change, forcing a second render pass
   * for no benefit.
   */
  const resolved = resolveTheme(theme, prefersDark);

  // Push the resolved theme to the document (an external system).
  useEffect(() => {
    applyResolvedTheme(resolved);
  }, [resolved]);

  // Persist the preference.
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Non-fatal: the theme still applies for this session.
    }
  }, [theme]);

  /*
   * Keep up with the OS while "system" is selected. This fires on an event, so
   * it is an external subscription rather than a cascading render.
   */
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent): void => setPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const update = useCallback((next: Theme) => setTheme(next), []);

  return { theme, resolved, setTheme: update };
}
