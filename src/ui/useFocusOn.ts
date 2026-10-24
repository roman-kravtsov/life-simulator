import { useEffect, useRef } from "react";

/**
 * Moves focus to an element when a screen mounts and whenever `key` changes
 * (for example each new year), so keyboard and screen-reader users follow along.
 */
export function useFocusOn<T extends HTMLElement>(key?: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [key]);
  return ref;
}
