import { describe, expect, it } from "vitest";
import { applyEffects } from "../../src/engine/effects";
import { newLife } from "../../src/engine/life";

const life = () => newLife({ seed: "effects", sex: "female", name: "Test" });

describe("applyEffects", () => {
  it("adds to a stat", () => {
    const before = life();
    const { state } = applyEffects(before, [{ stat: "health", add: -10 }], "chance");
    expect(state.person.stats.health).toBe(before.person.stats.health - 10);
  });

  it("clamps stats to 0..100", () => {
    const { state } = applyEffects(
      life(),
      [
        { stat: "skills", add: 500 },
        { stat: "bonds", add: -500 },
      ],
      "choice",
    );
    expect(state.person.stats.skills).toBe(100);
    expect(state.person.stats.bonds).toBe(0);
  });

  it("sets flags", () => {
    const { state } = applyEffects(
      life(),
      [
        { set: "lost_sibling", value: true },
        { set: "moves", value: 2 },
      ],
      "circumstance",
    );
    expect(state.person.flags).toMatchObject({ lost_sibling: true, moves: 2 });
  });

  it("does not mutate the input state", () => {
    const before = life();
    const snapshot = structuredClone(before);
    applyEffects(
      before,
      [
        { stat: "health", add: -10 },
        { set: "x", value: true },
      ],
      "chance",
    );
    expect(before).toEqual(snapshot);
  });

  it("records each applied effect with its cause tag and the actual change", () => {
    const before = life();
    before.person.stats.health = 95;
    const { applied } = applyEffects(before, [{ stat: "health", add: 10 }], "choice");
    expect(applied).toEqual([{ effect: { stat: "health", add: 10 }, cause: "choice", delta: 5 }]);
  });
});
