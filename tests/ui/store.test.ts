import { describe, expect, it, vi } from "vitest";
import { createGameStore } from "../../src/ui/store";

const seeds = () => {
  let n = 0;
  return () => `seed-${n++}`;
};

describe("game store", () => {
  it("starts on the start screen with no life", () => {
    const store = createGameStore(seeds());
    expect(store.getSnapshot()).toEqual({ screen: "start", life: null });
  });

  it("begins a life at age 0 on the life screen", () => {
    const store = createGameStore(seeds());
    store.begin();
    const { screen, life } = store.getSnapshot();
    expect(screen).toBe("life");
    expect(life?.person.age).toBe(0);
    expect(life?.seed).toBe("seed-0");
  });

  it("advances the life one year on continue", () => {
    const store = createGameStore(seeds());
    store.begin();
    store.continueYear();
    expect(store.getSnapshot().life?.person.age).toBe(1);
  });

  it("returns to the start screen", () => {
    const store = createGameStore(seeds());
    store.begin();
    store.backToStart();
    expect(store.getSnapshot()).toEqual({ screen: "start", life: null });
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const store = createGameStore(seeds());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.begin();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.continueYear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps a stable snapshot between changes", () => {
    const store = createGameStore(seeds());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("ignores continue when no life is in progress", () => {
    const store = createGameStore(seeds());
    const before = store.getSnapshot();
    store.continueYear();
    expect(store.getSnapshot()).toBe(before);
  });

  it("opens and closes the sources screen without a life", () => {
    const store = createGameStore(seeds());
    store.openSources();
    expect(store.getSnapshot()).toEqual({ screen: "sources", life: null });
    store.closeSources();
    expect(store.getSnapshot()).toEqual({ screen: "start", life: null });
  });
});
