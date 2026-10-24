import { describe, expect, it } from "vitest";
import { allHold, holds, indicatorValue, type Condition } from "../../src/engine/conditions";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const country = makeCountry();
const ctx = (overrides = {}) => ({ person: makePerson(overrides), country });

describe("stat conditions", () => {
  it("compares with < and >", () => {
    expect(holds({ stat: "health", op: ">", value: 60 }, ctx())).toBe(true);
    expect(holds({ stat: "health", op: ">", value: 70 }, ctx())).toBe(false);
    expect(holds({ stat: "health", op: "<", value: 71 }, ctx())).toBe(true);
    expect(holds({ stat: "health", op: "<", value: 70 }, ctx())).toBe(false);
  });
  it("checks a closed range with between", () => {
    const c: Condition = { stat: "skills", op: "between", value: [10, 20] };
    expect(holds(c, ctx())).toBe(true);
    expect(holds(c, ctx({ stats: { health: 70, wellbeing: 60, bonds: 60, skills: 21 } }))).toBe(false);
    expect(holds(c, ctx({ stats: { health: 70, wellbeing: 60, bonds: 60, skills: 9 } }))).toBe(false);
  });
});

describe("trait conditions", () => {
  it("compares a trait", () => {
    const traits = { temperament: 0, curiosity: 2, resilience: -1, sociability: 0, aptitude: 0, constitution: 0 };
    expect(holds({ trait: "curiosity", op: ">", value: 1 }, ctx({ traits }))).toBe(true);
    expect(holds({ trait: "resilience", op: "<", value: 0 }, ctx({ traits }))).toBe(true);
    expect(holds({ trait: "curiosity", op: "<", value: 1 }, ctx({ traits }))).toBe(false);
  });
});

describe("flag conditions", () => {
  it("matches a boolean or numeric flag, and treats a missing flag as false", () => {
    const person = { flags: { lost_mother: true, moves: 2 } };
    expect(holds({ flag: "lost_mother", is: true }, ctx(person))).toBe(true);
    expect(holds({ flag: "lost_mother", is: false }, ctx(person))).toBe(false);
    expect(holds({ flag: "moves", is: 2 }, ctx(person))).toBe(true);
    expect(holds({ flag: "moves", is: 3 }, ctx(person))).toBe(false);
    expect(holds({ flag: "never_set", is: false }, ctx(person))).toBe(true);
    expect(holds({ flag: "never_set", is: true }, ctx(person))).toBe(false);
  });
});

describe("world conditions", () => {
  it("reads an indicator from the country data", () => {
    expect(holds({ world: "work.unemployment", op: ">", value: 0.05 }, ctx())).toBe(true);
    expect(holds({ world: "work.unemployment", op: "<", value: 0.05 }, ctx())).toBe(false);
  });
  it("resolves a by-sex indicator with the person's sex", () => {
    expect(indicatorValue(country, "education.literacy", "female")).toBe(0.85);
    expect(indicatorValue(country, "education.literacy", "male")).toBe(0.9);
  });
  it("throws for a path that does not exist, so a typo in content is caught", () => {
    expect(() => indicatorValue(country, "work.nothing", "female")).toThrow(/work\.nothing/);
  });
});

describe("has conditions", () => {
  it("partner and child look at living relationships", () => {
    const rel = (kind: "partner" | "spouse" | "child", alive = true) => ({
      id: kind,
      kind,
      name: "X",
      sex: "male" as const,
      age: 30,
      alive,
      closeness: 70,
    });
    expect(holds({ has: "partner" }, ctx())).toBe(false);
    expect(holds({ has: "partner" }, ctx({ relationships: [rel("partner")] }))).toBe(true);
    expect(holds({ has: "partner" }, ctx({ relationships: [rel("spouse")] }))).toBe(true);
    expect(holds({ has: "partner" }, ctx({ relationships: [rel("spouse", false)] }))).toBe(false);
    expect(holds({ has: "child" }, ctx({ relationships: [rel("child")] }))).toBe(true);
    expect(holds({ has: "child" }, ctx({ relationships: [rel("partner")] }))).toBe(false);
  });
  it("job needs an employed or informal work status", () => {
    expect(holds({ has: "job" }, ctx())).toBe(false);
    expect(holds({ has: "job" }, ctx({ work: { status: "employed" } }))).toBe(true);
    expect(holds({ has: "job" }, ctx({ work: { status: "informal" } }))).toBe(true);
    expect(holds({ has: "job" }, ctx({ work: { status: "unemployed" } }))).toBe(false);
  });
  it("savings needs money put by", () => {
    expect(holds({ has: "savings" }, ctx())).toBe(false);
    expect(holds({ has: "savings" }, ctx({ money: { householdPercentile: 50, savings: 5, debt: 0 } }))).toBe(true);
  });
});

describe("age and location conditions", () => {
  it("age is an inclusive range", () => {
    expect(holds({ age: [10, 12] }, ctx())).toBe(true);
    expect(holds({ age: [11, 12] }, ctx())).toBe(false);
    expect(holds({ age: [8, 10] }, ctx())).toBe(true);
    expect(holds({ age: [8, 9] }, ctx())).toBe(false);
  });
  it("location matches rural or urban", () => {
    expect(holds({ location: "urban" }, ctx())).toBe(true);
    expect(holds({ location: "rural" }, ctx())).toBe(false);
  });
});

describe("allHold", () => {
  it("is true for no conditions and needs every condition otherwise", () => {
    expect(allHold(undefined, ctx())).toBe(true);
    expect(allHold([], ctx())).toBe(true);
    expect(allHold([{ age: [10, 10] }, { location: "urban" }], ctx())).toBe(true);
    expect(allHold([{ age: [10, 10] }, { location: "rural" }], ctx())).toBe(false);
  });
});
