import { describe, expect, it } from "vitest";
import { driftStats, healthNorm, skillGrowth } from "../../src/engine/drift";
import { createRng } from "../../src/engine/rng";
import { stageForAge } from "../../src/engine/stages";
import type { Person, TraitId } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";
import { makePerson, moneyAt } from "../fixtures/person";

const country = makeCountry();
const at = (age: number, overrides: Partial<Person> = {}) => makePerson({ age, stage: stageForAge(age), ...overrides });
const withTrait = (trait: TraitId, value: number) => ({
  traits: { temperament: 0, curiosity: 0, resilience: 0, sociability: 0, aptitude: 0, constitution: 0, [trait]: value },
});

describe("health norm (HEALTH-001)", () => {
  it("rises through childhood, holds in youth and falls with age", () => {
    const norms = [0, 10, 25, 45, 60, 75, 90].map((age) => healthNorm(at(age), country));
    expect(norms[1]).toBeGreaterThanOrEqual(norms[0]!);
    expect(norms[3]).toBeLessThan(norms[2]!);
    expect(norms[4]).toBeLessThan(norms[3]!);
    expect(norms[5]).toBeLessThan(norms[4]!);
    expect(norms[6]).toBeLessThan(norms[5]!);
  });
  it("stays within 0 to 100 at every age", () => {
    for (let age = 0; age <= 100; age++) {
      const n = healthNorm(at(age, withTrait("constitution", 2)), country);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });
  it("is higher with a stronger constitution", () => {
    expect(healthNorm(at(30, withTrait("constitution", 2)), country)).toBeGreaterThan(
      healthNorm(at(30, withTrait("constitution", -2)), country),
    );
  });
  it("is lower for a poor household than a rich one", () => {
    const poor = at(30, { money: moneyAt(5) });
    const rich = at(30, { money: moneyAt(95) });
    expect(healthNorm(poor, country)).toBeLessThan(healthNorm(rich, country));
  });
  it("is lower in rural areas", () => {
    expect(healthNorm(at(30, { location: "rural" }), country)).toBeLessThan(
      healthNorm(at(30, { location: "urban" }), country),
    );
  });
  it("is lower for a child at work", () => {
    expect(healthNorm(at(10, { flags: { childLabour: true } }), country)).toBeLessThan(healthNorm(at(10), country));
  });
});

describe("driftStats (SIM-004)", () => {
  const drift = (person: Person, seed = "d") => driftStats(person, country, createRng(seed));

  it("pulls health toward the norm from above and below", () => {
    const norm = healthNorm(at(30), country);
    const low = drift(at(30, { stats: { health: 10, happiness: 60, belonging: 60, skills: 20 } }));
    const high = drift(at(30, { stats: { health: 100, happiness: 60, belonging: 60, skills: 20 } }));
    expect(low.health).toBeGreaterThan(10);
    expect(low.health).toBeLessThanOrEqual(norm);
    expect(high.health).toBeLessThan(100);
    expect(high.health).toBeGreaterThanOrEqual(norm);
  });
  it("declines with age: an old person at their own norm loses ground year on year", () => {
    let person = at(60);
    person = { ...person, stats: { ...person.stats, health: healthNorm(person, country) } };
    const next = at(75);
    const before = healthNorm(person, country);
    expect(healthNorm(next, country)).toBeLessThan(before);
  });
  it("keeps every stat between 0 and 100", () => {
    for (let age = 0; age <= 100; age += 5) {
      for (let i = 0; i < 20; i++) {
        const s = drift(at(age, { stats: { health: 100, happiness: 100, belonging: 100, skills: 100 } }), `x${i}`);
        for (const v of Object.values(s)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });
  it("is deterministic for the same seed", () => {
    expect(drift(at(20), "same")).toEqual(drift(at(20), "same"));
  });
  it("grows skills fastest in school years and slowly in adulthood, and loses a little in old age", () => {
    const g = (age: number) =>
      skillGrowth(at(age, { stats: { health: 70, happiness: 60, belonging: 60, skills: 10 } }), country);
    expect(g(8)).toBeGreaterThan(g(2));
    expect(g(8)).toBeGreaterThan(g(40));
    expect(g(40)).toBeGreaterThan(0);
    expect(g(80)).toBeLessThan(0);
  });
  it("slows skill growth as skills approach the ceiling", () => {
    const g = (skills: number) =>
      skillGrowth(at(8, { stats: { health: 70, happiness: 60, belonging: 60, skills } }), country);
    expect(g(80)).toBeLessThan(g(10));
  });
  it("grows skills less where children rarely finish school", () => {
    const poorSchooling = makeCountry({
      education: {
        ...country.education,
        primaryCompletion: { ...country.education.primaryCompletion, value: { female: 0.3, male: 0.3 } },
      },
    });
    expect(skillGrowth(at(8), poorSchooling)).toBeLessThan(skillGrowth(at(8), country));
  });
  it("grows skills less in rural areas and for a child at work", () => {
    expect(skillGrowth(at(8, { location: "rural" }), country)).toBeLessThan(skillGrowth(at(8), country));
    expect(skillGrowth(at(8, { flags: { childLabour: true } }), country)).toBeLessThan(skillGrowth(at(8), country));
  });
});

describe("traits shape drift (CHAR-003)", () => {
  const mean = (trait: TraitId, value: number, pick: (s: ReturnType<typeof driftStats>) => number, age = 30) => {
    let total = 0;
    const n = 300;
    for (let i = 0; i < n; i++)
      total += pick(driftStats(at(age, withTrait(trait, value)), country, createRng(`t${i}`)));
    return total / n;
  };
  it("constitution raises health", () => {
    expect(mean("constitution", 2, (s) => s.health)).toBeGreaterThan(mean("constitution", -2, (s) => s.health));
  });
  it("aptitude raises skills", () => {
    expect(mean("aptitude", 2, (s) => s.skills, 9)).toBeGreaterThan(mean("aptitude", -2, (s) => s.skills, 9));
  });
  it("curiosity raises skills", () => {
    expect(mean("curiosity", 2, (s) => s.skills, 9)).toBeGreaterThan(mean("curiosity", -2, (s) => s.skills, 9));
  });
  it("sociability raises belonging", () => {
    expect(mean("sociability", 2, (s) => s.belonging)).toBeGreaterThan(mean("sociability", -2, (s) => s.belonging));
  });
  it("resilience raises happiness", () => {
    expect(mean("resilience", 2, (s) => s.happiness)).toBeGreaterThan(mean("resilience", -2, (s) => s.happiness));
  });
  it("temperament widens the swings in happiness without moving the average much", () => {
    const spread = (value: number) => {
      const xs = Array.from(
        { length: 400 },
        (_, i) => driftStats(at(30, withTrait("temperament", value)), country, createRng(`v${i}`)).happiness,
      );
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
    };
    expect(spread(2)).toBeGreaterThan(spread(-2) * 1.5);
  });
});
