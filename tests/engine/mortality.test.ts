import { describe, expect, it } from "vitest";
import {
  HAZARD_MAX,
  HAZARD_MIN,
  deathProbability,
  drawCause,
  hazardMultiplier,
  lifeExpectancy,
  rollDeath,
} from "../../src/engine/mortality";
import { createRng } from "../../src/engine/rng";
import { makeCountry, syntheticLifeTable } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const country = makeCountry();

describe("lifeExpectancy", () => {
  it("is the expected years lived from a life table", () => {
    // Everyone dies in their first year: about a tenth of a year lived on average.
    expect(lifeExpectancy([1])).toBeCloseTo(0.1, 5);
    // Certain death at the end of every year: half a year on top of the completed years.
    const certain = Array.from({ length: 11 }, (_, age) => (age === 10 ? 1 : 0));
    expect(lifeExpectancy(certain)).toBeCloseTo(10.5, 5);
  });
  it("rises when mortality falls", () => {
    const safer = syntheticLifeTable().map((q, i) => (i === 100 ? q : q / 2));
    expect(lifeExpectancy(safer)).toBeGreaterThan(lifeExpectancy(syntheticLifeTable()));
  });
});

describe("hazardMultiplier (HEALTH-002)", () => {
  it("is 1-ish for an average person and always inside the bounds", () => {
    expect(hazardMultiplier(makePerson(), country)).toBeGreaterThan(0.8);
    expect(hazardMultiplier(makePerson(), country)).toBeLessThan(1.25);
    const frail = makePerson({
      stats: { health: 0, happiness: 0, belonging: 0, skills: 0 },
      money: { householdPercentile: 1, savings: 0, debt: 0 },
      conditions: [1, 2, 3, 4, 5, 6].map((i) => ({ id: `c${i}`, severity: 3 as const })),
      location: "rural",
    });
    expect(hazardMultiplier(frail, country)).toBe(HAZARD_MAX);
    const robust = makePerson({
      stats: { health: 100, happiness: 100, belonging: 100, skills: 100 },
      money: { householdPercentile: 100, savings: 0, debt: 0 },
      traits: { temperament: 0, curiosity: 0, resilience: 0, sociability: 0, aptitude: 0, constitution: 2 },
    });
    expect(hazardMultiplier(robust, country)).toBeGreaterThanOrEqual(HAZARD_MIN);
  });
  it("rises with poor health, low household income, rural life and conditions", () => {
    const base = hazardMultiplier(makePerson(), country);
    expect(
      hazardMultiplier(makePerson({ stats: { health: 30, happiness: 60, belonging: 60, skills: 20 } }), country),
    ).toBeGreaterThan(base);
    expect(
      hazardMultiplier(makePerson({ money: { householdPercentile: 5, savings: 0, debt: 0 } }), country),
    ).toBeGreaterThan(base);
    expect(
      hazardMultiplier(makePerson({ money: { householdPercentile: 95, savings: 0, debt: 0 } }), country),
    ).toBeLessThan(base);
    expect(hazardMultiplier(makePerson({ location: "rural" }), country)).toBeGreaterThan(base);
    expect(hazardMultiplier(makePerson({ conditions: [{ id: "x", severity: 2 }] }), country)).toBeGreaterThan(base);
    expect(
      hazardMultiplier(
        makePerson({
          traits: { temperament: 0, curiosity: 0, resilience: 0, sociability: 0, aptitude: 0, constitution: -2 },
        }),
        country,
      ),
    ).toBeGreaterThan(base);
  });
});

describe("deathProbability", () => {
  it("is the life table value for the person's age and sex, times the multiplier", () => {
    const person = makePerson({ age: 40, sex: "male" });
    const qx = country.demography.lifeTable.value.male[40]!;
    expect(deathProbability(person, country)).toBeCloseTo(qx * hazardMultiplier(person, country), 10);
  });
  it("uses the sex-specific table", () => {
    const skewed = makeCountry({
      demography: {
        ...country.demography,
        lifeTable: {
          ...country.demography.lifeTable,
          value: { female: syntheticLifeTable().map((q) => q / 2), male: syntheticLifeTable() },
        },
      },
    });
    const male = makePerson({ age: 50, sex: "male" });
    const female = makePerson({ age: 50, sex: "female" });
    expect(deathProbability(male, skewed)).toBeGreaterThan(deathProbability(female, skewed) * 1.5);
  });
  it("is 1 at the end of the table, whatever the multiplier", () => {
    expect(deathProbability(makePerson({ age: 100 }), country)).toBe(1);
  });
  it("never exceeds 1", () => {
    const frail = makePerson({ age: 99, conditions: [{ id: "x", severity: 3 }] });
    expect(deathProbability(frail, country)).toBeLessThanOrEqual(1);
  });
});

describe("rollDeath", () => {
  it("reproduces the table's probability over many draws", () => {
    const person = makePerson({ age: 60 });
    const p = deathProbability(person, country);
    const rng = createRng("roll");
    let deaths = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) if (rollDeath(person, country, rng)) deaths++;
    expect(deaths / n).toBeGreaterThan(p - 0.01);
    expect(deaths / n).toBeLessThan(p + 0.01);
  });
});

describe("drawCause (HEALTH-003)", () => {
  const share = (
    sex: "female" | "male",
    age: number,
    id: string,
    conditions = [] as { id: string; severity: 1 | 2 | 3; raises?: string }[],
    n = 20000,
  ) => {
    const rng = createRng(`cause-${sex}-${age}-${id}`);
    let hits = 0;
    for (let i = 0; i < n; i++) if (drawCause(country, sex, age, conditions, rng) === id) hits++;
    return hits / n;
  };
  it("reproduces the cause mix of the person's age band and sex within tolerance", () => {
    expect(share("male", 5, "infectious")).toBeCloseTo(0.6, 1);
    expect(share("male", 5, "injury")).toBeCloseTo(0.4, 1);
    expect(share("female", 30, "injury")).toBeCloseTo(0.5, 1);
    expect(share("male", 30, "injury")).toBeCloseTo(0.6, 1);
    expect(share("female", 80, "noncommunicable")).toBeCloseTo(0.9, 1);
  });
  it("uses the band that contains the age, including the last band's end", () => {
    expect(share("female", 14, "infectious", [], 2000)).toBeGreaterThan(0.5);
    expect(share("female", 15, "infectious", [], 2000)).toBe(0);
    expect(share("female", 100, "noncommunicable", [], 2000)).toBeGreaterThan(0.8);
  });
  it("nudges the draw towards a cause a condition raises", () => {
    const heart = [{ id: "heart", severity: 3 as const, raises: "infectious" }];
    expect(share("female", 80, "infectious", heart)).toBeGreaterThan(share("female", 80, "infectious") * 2);
  });
  it("ignores a condition that raises a cause the band does not have", () => {
    const odd = [{ id: "x", severity: 3 as const, raises: "unknown" }];
    expect(share("female", 80, "noncommunicable", odd)).toBeCloseTo(0.9, 1);
  });
});
