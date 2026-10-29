// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createHintStore, HINTS } from "../../src/ui/hints";

const KEY = "birthright:hints";

function setup(initial?: string) {
  const storage = window.localStorage;
  storage.clear();
  if (initial !== undefined) storage.setItem(KEY, initial);
  return { storage, store: createHintStore(() => storage) };
}

describe("first-life hints (UI-015)", () => {
  it("names a hint for the plan, a decision and the odds lens", () => {
    expect(HINTS).toEqual(["plan", "decision", "lens"]);
  });

  it("has seen nothing when nothing is stored, and stores nothing", () => {
    const { store, storage } = setup();
    expect(store.getSnapshot()).toEqual([]);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("reads what was seen and ignores ids it does not know", () => {
    const { store } = setup("lens,plan,tooltips,,plan");
    expect(store.getSnapshot()).toEqual(["plan", "lens"]);
  });

  it("keeps what was seen, in a fixed order, under a birthright: key", () => {
    const { store, storage } = setup();
    store.see("lens");
    store.see("plan", "lens");
    expect(store.getSnapshot()).toEqual(["plan", "lens"]);
    expect(storage.getItem(KEY)).toBe("plan,lens");
    expect(KEY.startsWith("birthright:")).toBe(true);
  });

  it("tells subscribers once per change, with a new snapshot, and not when nothing changed", () => {
    const { store } = setup();
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    const before = store.getSnapshot();
    store.see("decision");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);
    const after = store.getSnapshot();
    store.see("decision");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(after);
    stop();
    store.reset();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("shows them all again after a reset, and forgets what was stored", () => {
    const { store, storage } = setup("plan,decision,lens");
    store.reset();
    expect(store.getSnapshot()).toEqual([]);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("works for this visit when storage is missing or refuses", () => {
    const refusing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    const store = createHintStore(() => refusing);
    expect(store.getSnapshot()).toEqual([]);
    store.see("plan");
    expect(store.getSnapshot()).toEqual(["plan"]);
    store.reset();
    expect(store.getSnapshot()).toEqual([]);
  });
});
