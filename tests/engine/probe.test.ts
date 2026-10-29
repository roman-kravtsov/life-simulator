// The agency probe (ADMIN-005): plans that are always valid, comparisons paired by life, forks that carry on
// from the same life, and the dominance check. The probe is the instrument the balance pass is judged by, so
// these tests check that it measures what it says it does.
import { describe, expect, it } from "vitest";
import { simulateLife } from "../../src/engine/calibration";
import { FOCUS_AREAS, isValidChoice, planTotal, resolvePlan } from "../../src/engine/focus";
import {
  STRATEGIES,
  average,
  balanceChecks,
  dominates,
  isClear,
  paired,
  planFor,
  playDecisions,
  playStrategy,
  probeDecisions,
  probeStrategies,
  type AreaReport,
  type Estimate,
  type LifeSpec,
  type Metric,
  type PlanRule,
  type StrategyReport,
} from "../../src/engine/probe";
import { stageForAge } from "../../src/engine/stages";
import type { Person } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const country = makeCountry({ region: "Western Africa" });
const specs = (count: number, prefix = "probe-test"): LifeSpec[] =>
  Array.from({ length: count }, (_, i) => ({ seed: `${prefix}-${i}`, country }));

const rules: PlanRule[] = [
  { kind: "default" },
  ...FOCUS_AREAS.map((area): PlanRule => ({ kind: "all-in", area })),
  ...FOCUS_AREAS.map((area): PlanRule => ({ kind: "shift", area })),
  { kind: "deliberate" },
];

const personAt = (age: number, overrides: Partial<Person> = {}): Person =>
  makePerson({ age, stage: stageForAge(age), ...overrides });

describe("the plans the probe plays", () => {
  it("leaves the default course alone, and everyone under six", () => {
    expect(planFor({ kind: "default" }, personAt(30))).toBeUndefined();
    for (const rule of rules) expect(planFor(rule, personAt(5))).toBeUndefined();
  });

  it("always spends exactly the points the person has, never in a locked area", () => {
    const illness = [{ id: "x", severity: 2, since: 1 }] as unknown as Person["conditions"];
    const people = [
      personAt(8, { education: { level: "none", inSchool: true, years: 2 } }),
      personAt(14, { flags: { childLabour: true } }),
      personAt(22, { work: { status: "employed", yearsWorked: 3, attachment: 0.5 } }),
      personAt(40, { work: { status: "unemployed", yearsWorked: 3, attachment: 0.5 } }),
      personAt(70, { work: { status: "retired", yearsWorked: 40, attachment: 0.5 } }),
      personAt(35, { conditions: illness }),
    ];
    for (const person of people) {
      for (const rule of rules) {
        const plan = planFor(rule, person);
        if (!plan) continue;
        expect(isValidChoice(person, plan), `${rule.kind} at ${person.age}`).toBe(true);
      }
    }
  });

  it("puts every free point on the area for all-in, and falls back to the default where it is locked", () => {
    const child = personAt(9, { education: { level: "none", inSchool: true, years: 3 } });
    const free = resolvePlan(child).free;
    expect(planFor({ kind: "all-in", area: "health" }, child)).toMatchObject({ health: free });
    expect(planFor({ kind: "all-in", area: "earn" }, child)).toEqual(resolvePlan(child).chosen);
  });

  it("moves only the point the default plan wants least", () => {
    const child = personAt(9, { education: { level: "none", inSchool: true, years: 3 } });
    const base = resolvePlan(child).chosen;
    const moved = planFor({ kind: "shift", area: "rest" }, child)!;
    expect(planTotal(moved)).toBe(planTotal(base));
    // The default for a pupil is Learn, Health, Belonging: Belonging is the last.
    expect(moved).toEqual({ ...base, belonging: base.belonging - 1, rest: base.rest + 1 });
    // Moving it to the area that already holds it changes nothing.
    expect(planFor({ kind: "shift", area: "belonging" }, child)).toEqual(base);
  });

  it("has a strategy for each rule and starts with the default course", () => {
    expect(STRATEGIES[0]!.plan.kind).toBe("default");
    expect(new Set(STRATEGIES.map((s) => s.id)).size).toBe(STRATEGIES.length);
  });
});

describe("paired comparisons", () => {
  it("takes the mean and standard error of the differences, skipping pairs with a missing value", () => {
    const e = paired([3, 5, undefined, 9], [1, 2, 4, undefined]);
    expect(e.n).toBe(2);
    expect(e.mean).toBeCloseTo(2.5);
    expect(e.se).toBeCloseTo(0.5);
    expect(paired([], [])).toEqual({ mean: 0, se: 0, n: 0 });
  });
  it("calls a difference clear only when it is more than two standard errors from zero", () => {
    expect(isClear({ mean: 1.1, se: 0.5, n: 20 })).toBe(true);
    expect(isClear({ mean: 0.9, se: 0.5, n: 20 })).toBe(false);
    expect(isClear({ mean: 5, se: 0, n: 1 })).toBe(false);
  });
  it("averages what is known", () => {
    expect(average([1, undefined, 3])).toEqual({ mean: 2, n: 2 });
  });
});

describe("playing lives", () => {
  it("plays the default course exactly as the calibration harness does", () => {
    for (const spec of specs(3)) {
      expect(playStrategy(spec, STRATEGIES[0]!).lifespan).toBe(simulateLife(spec.seed, country).death!.age);
    }
  });
  it("is deterministic, and a plan changes the life", () => {
    const [spec] = specs(1);
    const learn = STRATEGIES.find((s) => s.id === "shift-learn")!;
    expect(playStrategy(spec!, learn)).toEqual(playStrategy(spec!, learn));
    const outcomes = specs(8).map((s) => playStrategy(s, learn).skills35);
    const base = specs(8).map((s) => playStrategy(s, STRATEGIES[0]!).skills35);
    expect(outcomes).not.toEqual(base);
  });
  it("reads the outcomes at the ages it says", () => {
    const o = playStrategy(specs(1, "old")[0]!, STRATEGIES[0]!);
    expect(o.choiceShare + o.circumstanceShare + o.chanceShare).toBeCloseTo(1);
    expect(o.choiceNamed).toBeGreaterThanOrEqual(0);
    expect(o.choiceNamed).toBeLessThanOrEqual(4);
  });
});

describe("the strategy report", () => {
  const strategies = STRATEGIES.filter((s) => ["default", "shift-learn"].includes(s.id));
  const report = probeStrategies(specs(10), strategies);

  it("compares every plan with the default course on the same lives", () => {
    expect(report.lives).toBe(10);
    const base = report.strategies.find((s) => s.strategy.id === "default")!;
    for (const e of Object.values(base.versusDefault)) expect(e.mean).toBe(0);
    const learn = report.strategies.find((s) => s.strategy.id === "shift-learn")!;
    expect(learn.versusDefault.choiceShare.mean).toBeGreaterThan(0);
  });
  it("cannot be run without the default course to compare with", () => {
    expect(() => probeStrategies(specs(2), [STRATEGIES[1]!])).toThrow(/default course/);
  });
});

describe("the decision forks", () => {
  const lives = specs(12, "fork");

  it("starts every fork from the life the default course lives, so the default answer repeats it", () => {
    for (const spec of lives.slice(0, 4)) {
      const rows = playDecisions(spec);
      const whole = playStrategy(spec, STRATEGIES[0]!);
      for (const row of rows.filter((r) => r.isDefault)) expect(row.outcomes).toEqual(whole);
    }
  });
  it("has exactly one default answer to each decision it forks", () => {
    const rows = playDecisions(lives[0]!);
    const ids = new Set(rows.map((r) => r.eventId));
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(rows.filter((r) => r.eventId === id && r.isDefault)).toHaveLength(1);
    expect(rows.every((r) => !r.isDefault || r.outcomes.lifespan > 0)).toBe(true);
  });
  it("reports each choice against the default choice of the same decision", () => {
    const rows = probeDecisions(lives);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows.filter((r) => r.isDefault)) {
      for (const e of Object.values(row.versusDefault)) expect(e.mean).toBe(0);
    }
    expect(rows.some((r) => !r.isDefault && r.versusDefault.choiceShare.n > 0)).toBe(true);
  });
});

describe("the dominance check", () => {
  const zero: Estimate = { mean: 0, se: 0.1, n: 100 };
  const report = (id: string, deltas: Partial<Record<Metric, number>>): StrategyReport => ({
    strategy: { id, label: id, plan: { kind: "default" } },
    means: {} as StrategyReport["means"],
    versusDefault: new Proxy({} as Record<Metric, Estimate>, {
      get: (_, metric: string) => ({ ...zero, mean: deltas[metric as Metric] ?? 0 }),
    }),
  });

  it("finds a plan that is as good everywhere and clearly better somewhere", () => {
    const a = report("a", { rank35: 5, wealth45: 1 });
    const b = report("b", { rank35: 1 });
    expect(dominates(a, b)).toBe(true);
    expect(dominates(b, a)).toBe(false);
  });
  it("finds no domination where each plan wins something", () => {
    const a = report("a", { rank35: 5 });
    const b = report("b", { happiness: 3 });
    expect(dominates(a, b)).toBe(false);
    expect(dominates(b, a)).toBe(false);
  });
  it("reads less time out of work as better", () => {
    const a = report("a", { outOfWork: -0.5 });
    expect(dominates(a, report("b", {}))).toBe(true);
  });
  it("does not call equal plans dominant", () => {
    expect(dominates(report("a", {}), report("b", {}))).toBe(false);
  });
});

describe("the balance checks", () => {
  it("name the plan they cannot find", () => {
    const empty: AreaReport = { lives: 0, strategies: [] };
    expect(() => balanceChecks(empty)).toThrow(/default/);
  });
});
