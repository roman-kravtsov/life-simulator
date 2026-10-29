import { describe, expect, it } from "vitest";
import { driftBreakdown, driftStats, happinessNorm, healthNorm, skillGrowth } from "../../src/engine/drift";
import { DEFAULT_PLAN_CREDIT, FOCUS_EFFECT, planCredit } from "../../src/engine/focus";
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

describe("work and money weigh on the norms (WORLD-009, MONEY-004)", () => {
  const job = (sector: "agriculture" | "industry" | "services", formal: boolean) =>
    at(30, { work: { status: formal ? "employed" : "informal", sector, formal, yearsWorked: 5, attachment: 0.1 } });
  it("lowers the health norm in risky and informal work", () => {
    expect(healthNorm(job("industry", true), country)).toBeLessThan(healthNorm(job("services", true), country));
    expect(healthNorm(job("services", false), country)).toBeLessThan(healthNorm(job("services", true), country));
    expect(healthNorm(job("services", true), country)).toBeCloseTo(healthNorm(at(30), country), 6);
  });
  it("lowers the health norm for each condition, more at higher severity (HEALTH-004)", () => {
    const sick = (severity: 1 | 3) => at(50, { conditions: [{ id: "heart_disease", severity, since: 45 }] });
    expect(healthNorm(sick(1), country)).toBeLessThan(healthNorm(at(50), country));
    expect(healthNorm(sick(3), country)).toBeLessThan(healthNorm(sick(1), country));
  });
  it("lowers both norms under a heavy debt", () => {
    const indebted = at(30, { money: moneyAt(20, { debt: 1e6 }) });
    const free = at(30, { money: moneyAt(20) });
    expect(healthNorm(indebted, country)).toBeLessThan(healthNorm(free, country));
    expect(happinessNorm(indebted, country)).toBeLessThan(happinessNorm(free, country));
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
  const pupil = (age: number, overrides: Partial<Person> = {}) =>
    at(age, { education: { level: "none", inSchool: true, years: 2 }, ...overrides });
  it("grows skills fastest in school and slowly in adulthood, and loses a little in old age", () => {
    const g = (person: Person) =>
      skillGrowth({ ...person, stats: { health: 70, happiness: 60, belonging: 60, skills: 10 } });
    expect(g(pupil(8))).toBeGreaterThan(g(at(2)));
    expect(g(pupil(8))).toBeGreaterThan(g(at(40)));
    expect(g(at(40))).toBeGreaterThan(0);
    expect(g(at(80))).toBeLessThan(0);
  });
  it("slows skill growth as skills approach the ceiling", () => {
    const g = (skills: number) =>
      skillGrowth(pupil(8, { stats: { health: 70, happiness: 60, belonging: 60, skills } }));
    expect(g(80)).toBeLessThan(g(10));
  });
  it("grows skills far less for a child who is out of school (EDU-001)", () => {
    expect(skillGrowth(at(8))).toBeLessThan(skillGrowth(pupil(8)));
  });
  it("counts a six-year-old as a first-year pupil, because school starts this year", () => {
    expect(skillGrowth(at(6))).toBeCloseTo(skillGrowth(pupil(6)), 9);
  });
  it("grows skills more in secondary and tertiary study than in nothing, at every level", () => {
    for (const age of [8, 13, 16, 19]) expect(skillGrowth(pupil(age))).toBeGreaterThan(skillGrowth(at(age)));
  });
  it("grows skills less in rural schools and for a child at work", () => {
    expect(skillGrowth(pupil(8, { location: "rural" }))).toBeLessThan(skillGrowth(pupil(8)));
    expect(skillGrowth(pupil(8, { flags: { childLabour: true } }))).toBeLessThan(skillGrowth(pupil(8)));
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

describe("what the default plan counts for in the summary (SUM-004, Roman 2026-10-29)", () => {
  const pupil = at(10, { education: { level: "primary", inSchool: true, years: 4 } });
  // The default plan of a pupil: Learn, Health, Belonging, a point each, and no deviation from it.
  const reference = { learn: 1, earn: 0, health: 1, belonging: 1, rest: 0 };
  const breakdown = (kept?: boolean, focus: Person["focus"] = {}) =>
    driftBreakdown(
      { ...pupil, focus },
      country,
      createRng("breakdown"),
      kept ? { points: reference, default: reference } : undefined,
    );

  it("credits part of what the default plan's points do to choice, and the rest to circumstance", () => {
    const without = breakdown();
    const withDefault = breakdown(true);
    // Health holds one point in the default plan, worth FOCUS_EFFECT.health.norm on the norm.
    const worth = FOCUS_EFFECT.health.norm;
    expect(withDefault.norm.choice.health - without.norm.choice.health).toBeCloseTo(DEFAULT_PLAN_CREDIT * worth, 1);
    expect(withDefault.norm.circumstance.health - without.norm.circumstance.health).toBeCloseTo(
      (1 - DEFAULT_PLAN_CREDIT) * worth,
      1,
    );
    // Rest has no point in the default plan, so happiness gains nothing from it.
    expect(withDefault.norm.choice.happiness).toBe(without.norm.choice.happiness);
  });
  it("leaves the whole of the default plan's worth in the split, whatever share is credited", () => {
    const without = breakdown();
    const withDefault = breakdown(true);
    for (const id of ["health", "belonging", "skills"] as const) {
      const added =
        withDefault.norm.choice[id] -
        without.norm.choice[id] +
        (withDefault.norm.circumstance[id] - without.norm.circumstance[id]);
      expect(added).toBeGreaterThan(0);
    }
  });
  it("counts a departure from the default plan on top of it, wholly as choice", () => {
    const kept = breakdown(true);
    const moved = breakdown(true, { learn: 0.6 });
    expect(moved.norm.choice.skills).toBeGreaterThan(kept.norm.choice.skills);
    expect(moved.norm.circumstance.skills).toBe(kept.norm.circumstance.skills);
  });
  it("credits nothing before the plan begins, when there is no reference plan", () => {
    const young = driftBreakdown(at(3), country, createRng("breakdown"));
    expect(young.norm.choice).toEqual({ health: 0, happiness: 0, belonging: 0, skills: 0 });
  });
  it("gives the player more of the default's worth the more points they move", () => {
    const one = { learn: 0, earn: 1, health: 1, belonging: 1, rest: 0 };
    const all = { learn: 0, earn: 3, health: 0, belonging: 0, rest: 0 };
    expect(planCredit(reference, reference)).toBe(DEFAULT_PLAN_CREDIT);
    expect(planCredit(one, reference)).toBeGreaterThan(DEFAULT_PLAN_CREDIT);
    expect(planCredit(one, reference)).toBeLessThan(planCredit(all, reference));
    expect(planCredit(all, reference)).toBe(1);
  });
});
