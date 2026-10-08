export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "jobsmith.theme";

/**
 * Options and the side panel are both chrome-extension:// pages under the same extension ID, so
 * they share one origin and one localStorage -- toggling the theme in either place applies to
 * both, with no messaging needed.
 */
export function getStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage unavailable (e.g. this page opened outside the extension); default to light.
  }
  return "light";
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

export function setStoredTheme(mode: ThemeMode): void {
  applyTheme(mode);
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Theme still applies for this page load even if it can't persist.
  }
}
