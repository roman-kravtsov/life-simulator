// Light/dark theme (UI-011). Follows the system unless the player chooses.
const KEY = "birthright:theme";

type Theme = "light" | "dark";

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function applyStoredTheme(): void {
  const theme = stored();
  if (theme) document.documentElement.dataset.theme = theme;
}

export function toggleTheme(): void {
  const current =
    (document.documentElement.dataset.theme as Theme | undefined) ??
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next: Theme = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
}
