// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createDisplayStore, DEFAULT_DISPLAY, motionChoice, reducesMotion } from "../../src/ui/display";

const KEYS = { theme: "birthright:theme", textSize: "birthright:text-size", motion: "birthright:motion" };

function setup(initial: Record<string, string> = {}) {
  const storage = window.localStorage;
  storage.clear();
  for (const [key, value] of Object.entries(initial)) storage.setItem(key, value);
  const root = document.createElement("html");
  return {
    storage,
    root,
    store: createDisplayStore(
      () => root,
      () => storage,
    ),
  };
}

describe("display preferences (UI-009, A11Y-004, A11Y-005)", () => {
  it("starts from the defaults when nothing is stored, and puts no attribute on the page", () => {
    const { store, root } = setup();
    expect(store.getSnapshot()).toEqual(DEFAULT_DISPLAY);
    expect(DEFAULT_DISPLAY).toEqual({ theme: "system", textSize: "default", motion: "system" });
    expect(root.getAttributeNames()).toEqual([]);
  });

  it("reads what was stored and applies it to the page", () => {
    const { store, root } = setup({ [KEYS.theme]: "dark", [KEYS.textSize]: "larger", [KEYS.motion]: "reduced" });
    expect(store.getSnapshot()).toEqual({ theme: "dark", textSize: "larger", motion: "reduced" });
    expect(root.dataset).toMatchObject({ theme: "dark", textSize: "larger", motion: "reduced" });
  });

  it("ignores values it does not know", () => {
    const { store } = setup({ [KEYS.theme]: "sepia", [KEYS.textSize]: "huge", [KEYS.motion]: "sometimes" });
    expect(store.getSnapshot()).toEqual(DEFAULT_DISPLAY);
  });

  it("stores a choice, applies it, and returns to no attribute and no key for the default", () => {
    const { store, root, storage } = setup();
    store.set({ theme: "light", textSize: "large" });
    expect(root.dataset).toMatchObject({ theme: "light", textSize: "large" });
    expect(storage.getItem(KEYS.theme)).toBe("light");
    expect(storage.getItem(KEYS.textSize)).toBe("large");
    store.set({ theme: "system", textSize: "default" });
    expect(root.getAttributeNames()).toEqual([]);
    expect(storage.getItem(KEYS.theme)).toBeNull();
    expect(storage.getItem(KEYS.textSize)).toBeNull();
  });

  it("tells subscribers once per change, with a new snapshot, and not when nothing changed", () => {
    const { store } = setup();
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    const before = store.getSnapshot();
    store.set({ motion: "reduced" });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);
    store.set({ motion: "reduced" });
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    store.set({ motion: "full" });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("goes back to the defaults and forgets what it stored, for 'delete all local data'", () => {
    const { store, root, storage } = setup({ [KEYS.theme]: "dark", [KEYS.textSize]: "large" });
    store.reset();
    expect(store.getSnapshot()).toEqual(DEFAULT_DISPLAY);
    expect(root.getAttributeNames()).toEqual([]);
    expect(storage.getItem(KEYS.theme)).toBeNull();
  });

  it("still applies a choice when the browser will not store it", () => {
    const { root } = setup();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    const store = createDisplayStore(
      () => root,
      () => broken,
    );
    expect(store.getSnapshot()).toEqual(DEFAULT_DISPLAY);
    store.set({ textSize: "large" });
    expect(root.dataset.textSize).toBe("large");
    expect(store.getSnapshot().textSize).toBe("large");
  });

  it("keeps working where there is no storage or page at all", () => {
    const store = createDisplayStore(
      () => {
        throw new Error("no page");
      },
      () => {
        throw new Error("no storage");
      },
    );
    expect(store.getSnapshot()).toEqual(DEFAULT_DISPLAY);
    expect(() => store.set({ theme: "dark" })).not.toThrow();
  });

  describe("reduced motion", () => {
    it("follows the system until the player chooses, and then the player", () => {
      expect(reducesMotion({ ...DEFAULT_DISPLAY, motion: "system" }, true)).toBe(true);
      expect(reducesMotion({ ...DEFAULT_DISPLAY, motion: "system" }, false)).toBe(false);
      expect(reducesMotion({ ...DEFAULT_DISPLAY, motion: "reduced" }, false)).toBe(true);
      expect(reducesMotion({ ...DEFAULT_DISPLAY, motion: "full" }, true)).toBe(false);
    });

    it("turns the switch into a choice that says what the player meant", () => {
      expect(motionChoice(true, false)).toBe("reduced");
      expect(motionChoice(true, true)).toBe("reduced");
      // Off while the system asks for less is a choice of its own; otherwise it is the same as following the system.
      expect(motionChoice(false, true)).toBe("full");
      expect(motionChoice(false, false)).toBe("system");
    });
  });
});
