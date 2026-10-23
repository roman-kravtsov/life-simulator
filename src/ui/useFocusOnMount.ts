import { useEffect, useRef } from "react";

/** Moves focus to an element when a screen mounts, so keyboard and screen-reader users follow along. */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
