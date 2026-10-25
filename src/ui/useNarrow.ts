import { useSyncExternalStore } from "react";

/**
 * Below this width the life screen is one column with a bar of tabs (UI-010). The layout asks the browser instead of
 * reading the width itself. The width is in em (56.25em is 900 px at the usual text size), so a reader who has made
 * the text bigger gets the one-column layout sooner, before the columns get too narrow. styles.css repeats the number
 * for its scroll padding.
 */
export const NARROW_QUERY = "(width < 56.25em)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia?.(NARROW_QUERY);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/** True while the window is narrower than the three-column layout needs. A browser without matchMedia counts as wide. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(NARROW_QUERY).matches ?? false,
    () => false,
  );
}
