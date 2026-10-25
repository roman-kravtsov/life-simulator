import { describe, expect, it } from "vitest";
import {
  FOCUS_AREAS,
  FOCUS_BUDGET,
  MAX_FORCED,
  caregivingDuty,
  defaultPlan,
  emptyPlan,
  focusUnits,
  focusValue,
  forcedPoints,
  isValidChoice,
  lockedAreas,
  planTotal,
  resolvePlan,
} from "../../src/engine/focus";
import { stageForAge } from "../../src/engine/stages";
import type { HealthCondition, Person, Plan, Relationship } from "../../src/engine/types";
import { makePerson } from "../fixtures/person";

const at = (age: number, overrides: Partial<Person> = {}) => makePerson({ age, stage: stageForAge(age), ...overrides });
const plan = (overrides: Partial<Plan>): Plan => ({ ...emptyPlan(), ...overrides });
const relative = (overrides: Partial<Relationship>): Relationship => ({
  id: "r",
  kind: "mother",
  name: "Rel",
  sex: "female",
  age: 60,
  alive: true,
  closeness: 60,
  ...overrides,
});
// Hypertension at severity 3 costs a point; pneumonia at severity 3 costs two (see healthConditions.ts).
const sick = (id: string, severity: 1 | 2 | 3): HealthCondition => ({ id, severity, since: 20 });

describe("focus value (DEC-003)", () => {
  it("has diminishing returns: each extra point is worth less than the one before", () => {
    const gains = [1, 2, 3].map((n) => focusValue(n) - focusValue(n - 1));
    expect(focusValue(0)).toBe(0);
    expect(gains[0]).toBe(1);
    expect(gains[1]).toBeLessThan(gains[0]!);
    expect(gains[2]).toBeLessThan(gains[1]!);
  });
  it("makes spreading points worth more than stacking them", () => {
    expect(3 * focusValue(1)).toBeGreaterThan(focusValue(3));
  });
});

describe("the default plan", () => {
  it("spends the whole budget on learning, health and belonging for a child or a student", () => {
    expect(defaultPlan(at(8))).toEqual(plan({ learn: 1, health: 1, belonging: 1 }));
    expect(defaultPlan(at(20, { education: { level: "upper-secondary", inSchool: true, years: 14 } }))).toEqual(
      plan({ learn: 1, health: 1, belonging: 1 }),
    );
  });
  it("puts a point on earning for an adult out of school, and on rest for someone retired", () => {
    expect(defaultPlan(at(35))).toEqual(plan({ earn: 1, health: 1, belonging: 1 }));
    expect(defaultPlan(at(70, { work: { status: "retired", yearsWorked: 40, attachment: 0.5 } }))).toEqual(
      plan({ health: 1, belonging: 1, rest: 1 }),
    );
  });
  it.each([6, 12, 18, 40, 66])("always totals the budget (age %i)", (age) => {
    expect(planTotal(defaultPlan(at(age)))).toBe(FOCUS_BUDGET);
  });
});

describe("points circumstance takes (DEC-004)", () => {
  it("takes nothing from a healthy child with no duties", () => {
    expect(forcedPoints(at(9))).toEqual([]);
    expect(resolvePlan(at(9)).free).toBe(FOCUS_BUDGET);
  });
  it("puts a point on Earn for a working child (CAREER-004)", () => {
    const child = at(10, { flags: { childLabour: true } });
    expect(forcedPoints(child)).toEqual([{ area: "earn", points: 1, reason: "childLabour" }]);
    const view = resolvePlan(child);
    expect(view.free).toBe(2);
    expect(view.points.earn).toBe(1);
    expect(planTotal(view.points)).toBe(FOCUS_BUDGET);
  });
  it("puts points on Health for illness, as many as the condition costs (HEALTH-004)", () => {
    expect(forcedPoints(at(40, { conditions: [sick("hypertension", 3)] }))).toEqual([
      { area: "health", points: 1, reason: "illness" },
    ]);
    expect(forcedPoints(at(40, { conditions: [sick("pneumonia", 3)] }))).toEqual([
      { area: "health", points: 2, reason: "illness" },
    ]);
  });
  it("puts a point on Belonging for caring for a sick parent, a small sibling or a baby (FAM-005)", () => {
    const sickMother = at(30, { relationships: [relative({ ill: true })] });
    expect(forcedPoints(sickMother)).toEqual([{ area: "belonging", points: 1, reason: "caregiving" }]);
    const smallSibling = at(13, { relationships: [relative({ id: "s", kind: "sibling", age: 3 })] });
    expect(caregivingDuty(smallSibling)).toBe(true);
    const baby = at(27, { relationships: [relative({ id: "c", kind: "child", age: 1 })] });
    expect(caregivingDuty(baby)).toBe(true);
    expect(caregivingDuty(at(30, { relationships: [relative({ ill: true, alive: false })] }))).toBe(false);
    expect(caregivingDuty(at(30, { relationships: [relative({})] }))).toBe(false);
    expect(caregivingDuty(at(30, { relationships: [relative({ id: "c", kind: "child", age: 6 })] }))).toBe(false);
  });
  it("never takes more than the budget less one, whatever piles up", () => {
    const everything = at(10, {
      flags: { childLabour: true },
      conditions: [sick("pneumonia", 3)],
      relationships: [relative({ ill: true })],
    });
    const forced = forcedPoints(everything);
    expect(forced.reduce((sum, f) => sum + f.points, 0)).toBe(MAX_FORCED);
    expect(resolvePlan(everything).free).toBe(1);
  });
});

describe("locked areas (DEC-004, CAREER-006)", () => {
  it("locks Earn for a child who is not working, and for someone retired", () => {
    expect(lockedAreas(at(10))).toEqual({ earn: "tooYoung" });
    expect(lockedAreas(at(10, { flags: { childLabour: true } }))).toEqual({});
    expect(lockedAreas(at(15))).toEqual({});
    expect(lockedAreas(at(70, { work: { status: "retired", yearsWorked: 40, attachment: 0.5 } }))).toEqual({
      earn: "retired",
    });
  });
  it("lets points set aside in a locked area rest instead", () => {
    const retired = at(70, { work: { status: "retired", yearsWorked: 40, attachment: 0.5 } });
    const view = resolvePlan(retired, { points: plan({ earn: 2, belonging: 1 }), custom: true });
    expect(view.chosen).toEqual(plan({ belonging: 1, rest: 2 }));
  });
});

describe("resolving the plan", () => {
  it("follows the default for the situation until the player changes it", () => {
    const child = at(10);
    expect(resolvePlan(child).points).toEqual(plan({ learn: 1, health: 1, belonging: 1 }));
    const grown = at(30);
    expect(resolvePlan(grown, { points: plan({ learn: 1, health: 1, belonging: 1 }), custom: false }).points).toEqual(
      plan({ earn: 1, health: 1, belonging: 1 }),
    );
  });
  it("carries a plan the player set", () => {
    const view = resolvePlan(at(10), { points: plan({ learn: 2, rest: 1 }), custom: true });
    expect(view.points).toEqual(plan({ learn: 2, rest: 1 }));
  });
  it("gives the player only what circumstance leaves, and rests what is unspent", () => {
    const working = at(10, { flags: { childLabour: true } });
    const view = resolvePlan(working, { points: plan({ learn: 3 }), custom: true });
    expect(view.chosen).toEqual(plan({ learn: 2 }));
    expect(view.points).toEqual(plan({ learn: 2, earn: 1 }));
    expect(resolvePlan(at(10), { points: plan({ learn: 1 }), custom: true }).points).toEqual(
      plan({ learn: 1, rest: 2 }),
    );
  });
  it("always totals the budget", () => {
    for (const person of [
      at(7),
      at(12, { flags: { childLabour: true } }),
      at(60, { conditions: [sick("pneumonia", 3)] }),
    ]) {
      expect(planTotal(resolvePlan(person, { points: plan({ belonging: 3 }), custom: true }).points)).toBe(
        FOCUS_BUDGET,
      );
    }
  });
});

describe("focus units", () => {
  it("are zero on the default plan, in every area", () => {
    const units = focusUnits(resolvePlan(at(35)));
    for (const area of FOCUS_AREAS) expect(units[area]).toBe(0);
  });
  it("trade one area for another: more where points move to, less where they leave", () => {
    const units = focusUnits(resolvePlan(at(10), { points: plan({ learn: 3 }), custom: true }));
    expect(units.learn).toBeGreaterThan(0);
    expect(units.health).toBeLessThan(0);
    expect(units.belonging).toBeLessThan(0);
  });
  it("do not make illness a bonus: a point the default plan already gave to Health is covered, not added", () => {
    const view = resolvePlan(at(40, { conditions: [sick("hypertension", 3)] }));
    expect(view.forced).toEqual([{ area: "health", points: 1, reason: "illness" }]);
    expect(view.points).toEqual(plan({ earn: 1, health: 1, belonging: 1 }));
    const units = focusUnits(view);
    for (const area of FOCUS_AREAS) expect(units[area]).toBe(0);
  });
  it("still show the cost of a bigger illness: the second point displaces another area", () => {
    const view = resolvePlan(at(40, { conditions: [sick("pneumonia", 3)] }));
    expect(view.points.health).toBe(2);
    expect(planTotal(view.points)).toBe(FOCUS_BUDGET);
    expect(focusUnits(view).health).toBeGreaterThan(0);
    expect(focusUnits(view).belonging + focusUnits(view).earn).toBeLessThan(0);
  });
  it("show what circumstance costs: a working child gives up a point elsewhere", () => {
    const units = focusUnits(resolvePlan(at(10, { flags: { childLabour: true } })));
    expect(units.earn).toBeGreaterThan(0);
    expect(units.belonging).toBeLessThan(0);
  });
});

describe("valid choices", () => {
  it("accept exactly the free points and nothing in a locked area", () => {
    expect(isValidChoice(at(10), plan({ learn: 2, belonging: 1 }))).toBe(true);
    expect(isValidChoice(at(10), plan({ learn: 2 }))).toBe(false);
    expect(isValidChoice(at(10), plan({ earn: 1, learn: 2 }))).toBe(false);
    expect(isValidChoice(at(10, { flags: { childLabour: true } }), plan({ learn: 2 }))).toBe(true);
    expect(isValidChoice(at(10), plan({ learn: 1.5, belonging: 1.5 }))).toBe(false);
  });
});
