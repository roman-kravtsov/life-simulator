import { useSyncExternalStore } from "react";

/**
 * Below this width the life screen is one column with a bar of tabs (UI-010). The layout asks the browser instead of
 * reading the width itself, and the stylesheet needs no second copy of the number.
 */
export const NARROW_QUERY = "(max-width: 899px)";

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
