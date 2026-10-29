// First-life hints (UI-015): a few plain lines the first time the player meets the plan, a decision and the odds
// lens. A hint counts as seen once it has been put away or passed (the player went on, or answered), not as read: it
// can go without having been on screen. What has been seen belongs to the person at the screen and not to a life, so,
// like the display preferences, it is kept in this browser under its own key and is no part of any save; a second life
// starts with nothing to explain.

export type HintId = "plan" | "decision" | "lens";

/** Every hint, in the order they are met in a first life. */
export const HINTS: readonly HintId[] = ["plan", "decision", "lens"];

// Starts with `birthright:`, so "delete all local data" finds it (SAVE-007).
const KEY = "birthright:hints";

export interface HintStore {
  /** The hints already seen, in the order of `HINTS`. A new array only when it changes. */
  getSnapshot(): readonly HintId[];
  subscribe(listener: () => void): () => void;
  see(...ids: HintId[]): void;
  /** Every hint is new again, and what was stored is forgotten. */
  reset(): void;
}

/**
 * The hints seen as an external store for React. Storage is looked up when needed, and a browser that has none, or
 * refuses to store, is not an error: the hints already seen stay gone for this visit.
 */
export function createHintStore(storage: () => Storage): HintStore {
  const listeners = new Set<() => void>();

  const read = (): readonly HintId[] => {
    try {
      const stored = (storage().getItem(KEY) ?? "").split(",");
      return HINTS.filter((id) => stored.includes(id));
    } catch {
      return [];
    }
  };

  const write = (seen: readonly HintId[]) => {
    try {
      if (seen.length === 0) storage().removeItem(KEY);
      else storage().setItem(KEY, seen.join(","));
    } catch {
      // The hints seen hold until the page is closed.
    }
  };

  let current = read();

  const change = (next: readonly HintId[]) => {
    if (next.length === current.length && next.every((id, index) => id === current[index])) return;
    current = next;
    write(current);
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    see: (...ids) => change(HINTS.filter((id) => current.includes(id) || ids.includes(id))),
    reset: () => change([]),
  };
}

/** The one the app uses, in this browser's local storage. */
export const hintStore: HintStore = createHintStore(() => localStorage);
