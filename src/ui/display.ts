// How the page looks to this reader (UI-009, A11Y-004, A11Y-005, UI-011): the theme, the size of the text and
// whether to hold back motion. These belong to the person at the screen and not to a life, so they are kept in
// this browser under their own keys, apply to the whole page through attributes on the root element, and are not
// part of any save. Each is "system" or "default" until the player chooses; the page then has no attribute at all
// and follows the browser, whose own text size and colour scheme always count.

export type Theme = "system" | "light" | "dark";
export type TextSize = "default" | "large" | "larger";
export type Motion = "system" | "reduced" | "full";

export interface Display {
  theme: Theme;
  textSize: TextSize;
  motion: Motion;
}

export const DEFAULT_DISPLAY: Display = { theme: "system", textSize: "default", motion: "system" };

export const THEMES: readonly Theme[] = ["system", "light", "dark"];
export const TEXT_SIZES: readonly TextSize[] = ["default", "large", "larger"];

// Every key starts with `birthright:`, so "delete all local data" finds it (SAVE-007).
const KEYS = { theme: "birthright:theme", textSize: "birthright:text-size", motion: "birthright:motion" } as const;
/** The attribute each choice sets on the root element; the style sheet reads these. */
const ATTRIBUTES = { theme: "theme", textSize: "textSize", motion: "motion" } as const;

const CHOICES: { [K in keyof Display]: readonly Display[K][] } = {
  theme: THEMES,
  textSize: TEXT_SIZES,
  motion: ["system", "reduced", "full"],
};

/** Whether motion is held back: the player's choice when they made one, otherwise what the system asks for. */
export const reducesMotion = (display: Display, systemReduces: boolean): boolean =>
  display.motion === "system" ? systemReduces : display.motion === "reduced";

/** The choice to keep when the "reduce motion" switch is put on or off. */
export const motionChoice = (on: boolean, systemReduces: boolean): Motion =>
  on ? "reduced" : systemReduces ? "full" : "system";

export interface DisplayStore {
  getSnapshot(): Display;
  subscribe(listener: () => void): () => void;
  set(changes: Partial<Display>): void;
  /** Back to the defaults, forgetting what was stored. */
  reset(): void;
}

/**
 * The preferences as an external store for React. The page and storage are looked up when needed, and a page or a
 * browser that has neither, or refuses to store, is not an error: the choice still applies for this visit.
 */
export function createDisplayStore(root: () => HTMLElement, storage: () => Storage): DisplayStore {
  const listeners = new Set<() => void>();

  const read = (): Display => {
    const display = { ...DEFAULT_DISPLAY };
    try {
      const store = storage();
      for (const name of Object.keys(KEYS) as (keyof Display)[]) {
        const value = store.getItem(KEYS[name]);
        if (value !== null && (CHOICES[name] as readonly string[]).includes(value)) {
          (display as Record<string, string>)[name] = value;
        }
      }
    } catch {
      // No storage, or a browser that blocks it: the defaults.
    }
    return display;
  };

  const apply = (display: Display) => {
    try {
      const element = root();
      for (const name of Object.keys(ATTRIBUTES) as (keyof Display)[]) {
        const value = display[name];
        if (value === DEFAULT_DISPLAY[name]) delete element.dataset[ATTRIBUTES[name]];
        else element.dataset[ATTRIBUTES[name]] = value;
      }
    } catch {
      // No page to apply it to.
    }
  };

  const write = (display: Display) => {
    try {
      const store = storage();
      for (const name of Object.keys(KEYS) as (keyof Display)[]) {
        if (display[name] === DEFAULT_DISPLAY[name]) store.removeItem(KEYS[name]);
        else store.setItem(KEYS[name], display[name]);
      }
    } catch {
      // The choice holds until the page is closed.
    }
  };

  let current = read();
  apply(current);

  const change = (next: Display) => {
    if ((Object.keys(next) as (keyof Display)[]).every((name) => next[name] === current[name])) return;
    current = next;
    apply(current);
    write(current);
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (changes) => change({ ...current, ...changes }),
    reset: () => change({ ...DEFAULT_DISPLAY }),
  };
}

/** The one the app uses, on the page and in this browser's local storage. */
export const displayStore: DisplayStore = createDisplayStore(
  () => document.documentElement,
  () => localStorage,
);

/** The theme the page is showing now: the player's choice, or the system's when they have not made one. */
export function shownTheme(display: Display): "light" | "dark" {
  if (display.theme !== "system") return display.theme;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const systemReducesMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The quick toggle in the headers: the other one of light and dark. */
export const toggleTheme = (): void =>
  displayStore.set({ theme: shownTheme(displayStore.getSnapshot()) === "dark" ? "light" : "dark" });
