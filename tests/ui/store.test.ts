import { describe, expect, it, vi } from "vitest";
import { SEED_PATTERN } from "../../src/engine/seed";
import { browserSeed, createGameStore } from "../../src/ui/store";
import { testWorld } from "../fixtures/country";

const seeds = () => {
  let n = 0;
  return () => `seed-${n++}`;
};

const setup = () => createGameStore(seeds(), testWorld());

describe("game store", () => {
  it("starts on the start screen with no life", () => {
    expect(setup().getSnapshot()).toMatchObject({ screen: "start", life: null, country: null, status: "idle" });
  });

  it("begins a life: loads the world, draws the country and shows the birth screen", async () => {
    const store = setup();
    const done = store.begin();
    expect(store.getSnapshot().status).toBe("loading");
    await done;
    const { screen, life, country, status } = store.getSnapshot();
    expect(screen).toBe("birth");
    expect(status).toBe("idle");
    expect(country?.iso3).toBe("AAA");
    expect(life?.person.age).toBe(0);
    expect(life?.person.countryIso3).toBe("AAA");
    expect(life?.seed).toBe("seed-0");
  });

  it("moves from the birth screen into the first year", async () => {
    const store = setup();
    await store.begin();
    store.startLife();
    expect(store.getSnapshot().screen).toBe("life");
    expect(store.getSnapshot().life?.person.age).toBe(0);
  });

  it("advances the life one year on continue and nothing else moves it (TIME-001)", async () => {
    const store = setup();
    await store.begin();
    store.startLife();
    store.continueYear();
    expect(store.getSnapshot().life?.history).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getSnapshot().life?.history).toHaveLength(1);
  });

  it("stops advancing once the person has died", async () => {
    const store = setup();
    await store.begin();
    store.startLife();
    for (let i = 0; i < 120 && store.getSnapshot().life?.person.alive; i++) store.continueYear();
    const ended = store.getSnapshot();
    expect(ended.life?.person.alive).toBe(false);
    store.continueYear();
    expect(store.getSnapshot()).toBe(ended);
  });

  it("returns to the start screen", async () => {
    const store = setup();
    await store.begin();
    store.backToStart();
    expect(store.getSnapshot()).toMatchObject({ screen: "start", life: null, country: null });
  });

  it("can begin another life after one ends, with a new seed", async () => {
    const store = setup();
    await store.begin();
    await store.begin();
    expect(store.getSnapshot().life?.seed).toBe("seed-1");
  });

  it("shows an error and lets the player try again when the world fails to load", async () => {
    const world = testWorld();
    const loadIndex = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(world.loadIndex);
    const store = createGameStore(seeds(), { ...world, loadIndex });
    await store.begin();
    expect(store.getSnapshot()).toMatchObject({ screen: "start", status: "error" });
    await store.begin();
    expect(store.getSnapshot().screen).toBe("birth");
  });

  it("ignores a load that finishes after the player went back", async () => {
    const world = testWorld();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const store = createGameStore(seeds(), { ...world, loadIndex: () => gate.then(world.loadIndex) });
    const done = store.begin();
    store.backToStart();
    release();
    await done;
    expect(store.getSnapshot().screen).toBe("start");
  });

  it("ignores a second begin while one is loading", async () => {
    const world = testWorld();
    const loadIndex = vi.fn(world.loadIndex);
    const store = createGameStore(seeds(), { ...world, loadIndex });
    await Promise.all([store.begin(), store.begin()]);
    expect(loadIndex).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on change and stops after unsubscribe", async () => {
    const store = setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    await store.begin();
    const calls = listener.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    unsubscribe();
    store.startLife();
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it("keeps a stable snapshot between changes", () => {
    const store = setup();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("ignores continue when no life is in progress", () => {
    const store = setup();
    const before = store.getSnapshot();
    store.continueYear();
    expect(store.getSnapshot()).toBe(before);
  });

  it("opens and closes the sources screen without a life", () => {
    const store = setup();
    store.openSources();
    expect(store.getSnapshot()).toMatchObject({ screen: "sources", life: null });
    store.closeSources();
    expect(store.getSnapshot()).toMatchObject({ screen: "start", life: null });
  });
});

describe("browserSeed (RNG-003)", () => {
  it("makes a readable seed", () => {
    expect(browserSeed()).toMatch(SEED_PATTERN);
  });
});
