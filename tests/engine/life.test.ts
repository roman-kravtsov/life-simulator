import { describe, expect, it } from "vitest";
import { advance, newLife } from "../../src/engine/life";

describe("newLife", () => {
  it("starts at age 0, alive, in infancy, with stats in range", () => {
    const state = newLife({ seed: "a", sex: "male", name: "Test" });
    expect(state.person.age).toBe(0);
    expect(state.person.alive).toBe(true);
    expect(state.person.stage).toBe("infancy");
    for (const v of Object.values(state.person.stats)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(state.seed).toBe("a");
    expect(state.history).toEqual([]);
  });
});

describe("advance", () => {
  it("ages the person by one year and records the year", () => {
    const { state } = advance(newLife({ seed: "a", sex: "female", name: "Test" }), { kind: "continue" });
    expect(state.person.age).toBe(1);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({ age: 1, stage: "infancy" });
  });

  it("updates the life stage when crossing a boundary", () => {
    let state = newLife({ seed: "a", sex: "female", name: "Test" });
    for (let i = 0; i < 3; i++) state = advance(state, { kind: "continue" }).state;
    expect(state.person.stage).toBe("childhood");
    expect(state.history.at(-1)).toMatchObject({ age: 3, stage: "childhood", stageChanged: true });
  });

  it("does not mutate the previous state", () => {
    const before = newLife({ seed: "a", sex: "female", name: "Test" });
    const snapshot = structuredClone(before);
    advance(before, { kind: "continue" });
    expect(before).toEqual(snapshot);
  });

  it("refuses to advance a life that has ended", () => {
    const ended = newLife({ seed: "a", sex: "female", name: "Test" });
    ended.person.alive = false;
    expect(() => advance(ended, { kind: "continue" })).toThrow();
  });

  it("is deterministic for the same seed and inputs", () => {
    const run = () => {
      let s = newLife({ seed: "same", sex: "female", name: "Test" });
      for (let i = 0; i < 20; i++) s = advance(s, { kind: "continue" }).state;
      return s;
    };
    expect(run()).toEqual(run());
  });
});
