import { describe, expect, it } from "vitest";
import { applyEffects } from "../../src/engine/effects";
import { newLife } from "../../src/engine/life";
import { makeCountry } from "../fixtures/country";

const life = () => newLife({ seed: "effects", country: makeCountry({ region: "Western Africa" }) });

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
        { stat: "belonging", add: -500 },
      ],
      "choice",
    );
    expect(state.person.stats.skills).toBe(100);
    expect(state.person.stats.belonging).toBe(0);
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

  describe("relationship effects (REL-001)", () => {
    const friend = {
      id: "friend-1",
      kind: "friend" as const,
      name: "Ife",
      sex: "female" as const,
      age: 12,
      alive: true,
      closeness: 50,
    };
    it("adds a relative", () => {
      const { state } = applyEffects(life(), [{ relationship: "add", relative: friend }], "chance");
      expect(state.person.relationships.at(-1)).toEqual(friend);
    });
    it("does not add the same relative twice", () => {
      const once = applyEffects(life(), [{ relationship: "add", relative: friend }], "chance").state;
      const twice = applyEffects(once, [{ relationship: "add", relative: friend }], "chance").state;
      expect(twice.person.relationships.filter((r) => r.id === "friend-1")).toHaveLength(1);
    });
    it("removes a relative by id", () => {
      const withFriend = applyEffects(life(), [{ relationship: "add", relative: friend }], "chance").state;
      const { state } = applyEffects(withFriend, [{ relationship: "remove", id: "friend-1" }], "choice");
      expect(state.person.relationships.some((r) => r.id === "friend-1")).toBe(false);
    });
    it("changes closeness for one relative, or for every living relative of a kind, within 0 to 100", () => {
      const base = life();
      const mother = base.person.relationships.find((r) => r.kind === "mother")!;
      const one = applyEffects(base, [{ relationship: "closeness", id: "mother", amount: -1000 }], "choice").state;
      expect(one.person.relationships.find((r) => r.kind === "mother")!.closeness).toBe(0);
      expect(one.person.relationships.find((r) => r.kind === "father")!.closeness).toBe(
        base.person.relationships.find((r) => r.kind === "father")!.closeness,
      );
      const kind = applyEffects(base, [{ relationship: "closeness", kind: "mother", amount: 5 }], "choice").state;
      expect(kind.person.relationships.find((r) => r.kind === "mother")!.closeness).toBe(
        Math.min(100, mother.closeness + 5),
      );
    });
    it("leaves the dead alone", () => {
      const base = life();
      const dead = {
        ...base,
        person: { ...base.person, relationships: base.person.relationships.map((r) => ({ ...r, alive: false })) },
      };
      const { state } = applyEffects(dead, [{ relationship: "closeness", amount: 10 }], "choice");
      expect(state.person.relationships).toEqual(dead.person.relationships);
    });
  });

  describe("condition effects (HEALTH-004)", () => {
    it("adds a condition with the age it began at", () => {
      const base = life();
      const aged = { ...base, person: { ...base.person, age: 40 } };
      const { state } = applyEffects(
        aged,
        [{ condition: "add", id: "diabetes", severity: 1, raises: "diabetes" }],
        "chance",
      );
      expect(state.person.conditions).toEqual([{ id: "diabetes", severity: 1, since: 40, raises: "diabetes" }]);
    });
    it("a condition already there keeps its start and takes the new severity", () => {
      const base = life();
      const once = applyEffects(
        { ...base, person: { ...base.person, age: 40 } },
        [{ condition: "add", id: "x", severity: 1 }],
        "chance",
      ).state;
      const later = applyEffects(
        { ...once, person: { ...once.person, age: 45 } },
        [{ condition: "add", id: "x", severity: 3 }],
        "chance",
      ).state;
      expect(later.person.conditions).toEqual([{ id: "x", severity: 3, since: 40 }]);
    });
    it("removes a condition", () => {
      const once = applyEffects(life(), [{ condition: "add", id: "x", severity: 2 }], "chance").state;
      const { state } = applyEffects(once, [{ condition: "remove", id: "x" }], "choice");
      expect(state.person.conditions).toEqual([]);
    });
  });
});
