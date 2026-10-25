import { describe, expect, it } from "vitest";
import { en } from "../../src/content/strings/en";
import {
  DEATH_GROUPS,
  compareWithExpectancy,
  deathGroup,
  deathRecord,
  EXPECTANCY_SIMILAR_YEARS,
} from "../../src/engine/death";
import { advanceAuto, newLife } from "../../src/engine/life";
import { lifeExpectancy } from "../../src/engine/mortality";
import { LIFE_STAGES } from "../../src/engine/stages";
import type { LifeState } from "../../src/engine/types";
import { makeCountry, syntheticLifeTable } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa" });

function lived(seed: string, softening = false): LifeState {
  let life = newLife({ seed, country, settings: { pace: "every-year", softening } });
  while (life.person.alive) life = advanceAuto(life, country);
  return life;
}

describe("DEATH-001: the record of a death", () => {
  it("is complete for every death: age, cause, year, group, stage and the passage keys", () => {
    for (let i = 0; i < 40; i++) {
      const life = lived(`death-${i}`);
      const record = deathRecord(life, country);
      expect(record.age).toBe(life.person.age);
      expect(record.age).toBe(life.history.at(-1)!.age);
      expect(life.history.at(-1)!.died).toBe(true);
      expect(record.cause).toBe(life.death!.cause);
      expect(record.year).toBe(life.person.birthYear + record.age);
      expect(DEATH_GROUPS).toContain(record.group);
      expect(LIFE_STAGES).toContain(record.stage);
      expect(en).toHaveProperty([record.passageKey]);
      expect(en).toHaveProperty([record.codaKey]);
    }
  });

  it("refuses a life that has not ended", () => {
    expect(() => deathRecord(newLife({ seed: "alive", country }), country)).toThrow(/not ended/);
  });

  it("uses the softened passage when softening is on", () => {
    const hard = deathRecord(lived("soft-1"), country);
    const soft = deathRecord(lived("soft-1", true), country);
    expect(hard.passageKey).not.toMatch(/\.soft$/);
    expect(soft.passageKey).toMatch(/\.soft$/);
  });
});

describe("DEATH-002: the closing passages", () => {
  it("has a normal and a softened passage for every cause group, and a coda for every stage", () => {
    for (const group of DEATH_GROUPS) {
      expect(en, group).toHaveProperty([`death.passage.${group}`]);
      expect(en, group).toHaveProperty([`death.passage.${group}.soft`]);
    }
    for (const stage of LIFE_STAGES) expect(en, stage).toHaveProperty([`death.coda.${stage}`]);
  });

  it("has about 12 cause groups and puts every cause of the WHO mix into one", () => {
    expect(DEATH_GROUPS.length).toBeGreaterThanOrEqual(12);
    expect(DEATH_GROUPS.length).toBeLessThanOrEqual(14);
    const causes = [
      "infectious",
      "respiratoryInfection",
      "maternal",
      "neonatal",
      "nutritional",
      "cancer",
      "diabetes",
      "cardiovascular",
      "chronicRespiratory",
      "digestive",
      "congenital",
      "unintentionalInjury",
      "selfHarm",
      "violence",
      "conflict",
      "other",
    ];
    for (const cause of causes) {
      expect(DEATH_GROUPS, cause).toContain(deathGroup(cause));
      expect(en, cause).toHaveProperty([`cause.${cause}`]);
    }
  });

  it("puts a cause it does not know into the last group", () => {
    expect(deathGroup("something-new")).toBe("other");
  });

  it("is short, in the second person and never graphic", () => {
    const graphic =
      /\b(blood|bleed|bled|gore|wound|stab|shot|shoot|hang|gun|knife|rope|pills|overdose|corpse|body lies)\b/i;
    for (const group of DEATH_GROUPS) {
      for (const key of [`death.passage.${group}`, `death.passage.${group}.soft`]) {
        expect(en[key]!, key).not.toMatch(graphic);
        expect(en[key]!.length, key).toBeLessThan(400);
      }
    }
  });
});

describe("DEATH-003: the age at death against the country's life expectancy", () => {
  const table = syntheticLifeTable();
  const expected = lifeExpectancy(table);

  it("gives the life expectancy at birth of the person's sex, with its source and year", () => {
    const comparison = compareWithExpectancy("female", 40, country);
    expect(comparison.expected).toBeCloseTo(expected, 6);
    expect(comparison.source).toBe("test");
    expect(comparison.year).toBe(2023);
  });

  it("says by how much a life was shorter or longer, and when it was about the same", () => {
    const shorter = compareWithExpectancy("male", Math.round(expected) - 20, country);
    expect(shorter.verdict).toBe("shorter");
    expect(shorter.difference).toBeLessThan(-EXPECTANCY_SIMILAR_YEARS);
    const longer = compareWithExpectancy("male", Math.round(expected) + 15, country);
    expect(longer.verdict).toBe("longer");
    expect(longer.difference).toBeGreaterThan(EXPECTANCY_SIMILAR_YEARS);
    expect(compareWithExpectancy("male", Math.round(expected), country).verdict).toBe("similar");
  });

  it("gives the share of people of the same sex who live to that age", () => {
    expect(compareWithExpectancy("female", 0, country).reached).toBe(1);
    let alive = 1;
    for (let age = 0; age < 30; age++) alive *= 1 - table[age]!;
    expect(compareWithExpectancy("female", 30, country).reached).toBeCloseTo(alive, 10);
    expect(compareWithExpectancy("female", 100, country).reached).toBeGreaterThan(0);
    expect(compareWithExpectancy("female", 100, country).reached).toBeLessThan(0.01);
  });

  it("is part of every death record", () => {
    const record = deathRecord(lived("expectancy-1"), country);
    expect(record.expectancy.expected).toBeGreaterThan(0);
    expect(record.expectancy.reached).toBeGreaterThanOrEqual(0);
    expect(record.expectancy.reached).toBeLessThanOrEqual(1);
  });
});
