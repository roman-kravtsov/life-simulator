import { useEffect, useRef } from "react";

/**
 * Moves focus to an element when a screen mounts and whenever `key` changes
 * (for example each new year), so keyboard and screen-reader users follow along.
 * While `enabled` is false it leaves focus alone, for a heading that gives way to another.
 */
export function useFocusOn<T extends HTMLElement>(key?: unknown, enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [key, enabled]);
  return ref;
}
