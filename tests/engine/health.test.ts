import { describe, expect, it } from "vitest";
import { conditionCatalog } from "../../src/content/healthConditions";
import { en } from "../../src/content/strings/en";
import {
  conditionHazard,
  expectedHazardFactor,
  createConditionCatalog,
  focusPointsLost,
  healthPenalty,
  onsetProbability,
  stepConditions,
  type ConditionDef,
} from "../../src/engine/health";
import { hazardMultiplier } from "../../src/engine/mortality";
import { stageForAge } from "../../src/engine/stages";
import type { HealthCondition, Person } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";
import { makePerson, moneyAt } from "../fixtures/person";

const country = makeCountry();
const at = (age: number, overrides: Partial<Person> = {}) => makePerson({ age, stage: stageForAge(age), ...overrides });
const has = (id: string, severity: 1 | 2 | 3 = 1, since = 20): HealthCondition => ({ id, severity, since });

const def = (overrides: Partial<ConditionDef> = {}): ConditionDef => ({
  id: "test",
  ages: [0, 100],
  onset: 0.1,
  worsen: 0.1,
  recover: 0.1,
  hazard: 0.3,
  healthPenalty: 2,
  focusCost: [0, 1, 2],
  ...overrides,
});

describe("the conditions in the game (HEALTH-004)", () => {
  it("has at least ten, each with a distinct id", () => {
    expect(conditionCatalog.all.length).toBeGreaterThanOrEqual(10);
    expect(new Set(conditionCatalog.all.map((d) => d.id)).size).toBe(conditionCatalog.all.length);
  });
  it("makes each one change the hazard multiplier, at every severity", () => {
    const base = hazardMultiplier(at(50), country);
    for (const d of conditionCatalog.all) {
      const mild = hazardMultiplier(at(50, { conditions: [has(d.id, 1)] }), country);
      const severe = hazardMultiplier(at(50, { conditions: [has(d.id, 3)] }), country);
      expect(mild, d.id).toBeGreaterThan(base);
      expect(severe, d.id).toBeGreaterThan(mild);
    }
  });
  it("names each one and writes its three moments in the strings", () => {
    for (const d of conditionCatalog.all) {
      for (const key of [
        `condition.${d.id}`,
        `event.condition.${d.id}.begins`,
        `event.condition.${d.id}.worsens`,
        `event.condition.${d.id}.ends`,
      ]) {
        expect(en, key).toHaveProperty([key]);
      }
    }
  });
  it("points each cause it raises at a cause the data has", () => {
    const causes = new Set([
      "infectious",
      "respiratoryInfection",
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
    ]);
    for (const d of conditionCatalog.all) if (d.raises) expect(causes.has(d.raises), d.id).toBe(true);
  });
  it("marks mental health with a help topic and never makes it graphic", () => {
    const depression = conditionCatalog.get("depression")!;
    expect(depression.helpTopic).toBe("suicide");
    expect(depression.sensitivity).toBe("difficult");
  });
});

describe("catalog", () => {
  it("rejects duplicates, bad ages and bad probabilities", () => {
    expect(() => createConditionCatalog([def(), def()])).toThrow(/Duplicate/);
    expect(() => createConditionCatalog([def({ ages: [50, 20] })])).toThrow(/ages/);
    expect(() => createConditionCatalog([def({ onset: 2 })])).toThrow(/between 0 and 1/);
    expect(() => createConditionCatalog([def({ recover: -0.1 })])).toThrow(/between 0 and 1/);
  });
});

describe("onsetProbability", () => {
  const p = (d: ConditionDef, person: Person, c = country) => onsetProbability(d, person, c);
  it("is zero outside the condition's ages and for anyone who has it", () => {
    const d = def({ ages: [30, 60] });
    expect(p(d, at(20))).toBe(0);
    expect(p(d, at(61))).toBe(0);
    expect(p(d, at(40))).toBeGreaterThan(0);
  });
  it("follows the age curve", () => {
    const d = def({
      ageCurve: [
        [30, 0.2],
        [70, 1.6],
      ],
    });
    expect(p(d, at(70))).toBeGreaterThan(p(d, at(30)));
  });
  it("is higher for the poor where the condition follows poverty, and lower for the rich", () => {
    const d = def({ poverty: 3 });
    expect(p(d, at(40, { money: moneyAt(5) }))).toBeGreaterThan(p(d, at(40, { money: moneyAt(50) })));
    expect(p(d, at(40, { money: moneyAt(95) }))).toBeLessThan(p(d, at(40, { money: moneyAt(50) })));
  });
  it("is higher in the countryside where the condition follows place (WORLD-009)", () => {
    const d = def({ rural: 1.5 });
    expect(p(d, at(40, { location: "rural" }))).toBeGreaterThan(p(d, at(40, { location: "urban" })));
  });
  it("is higher in the jobs that cause it", () => {
    const d = def({ jobs: { industry: 2 } });
    const job = (sector: "industry" | "services") =>
      at(40, { work: { status: "employed", sector, formal: true, yearsWorked: 10, attachment: 0.1 } });
    expect(p(d, job("industry"))).toBeGreaterThan(p(d, job("services")));
    expect(p(d, at(40))).toBe(p(d, job("services")));
  });
  it("follows the country's cause-of-death mix: more where that cause is a bigger share of deaths", () => {
    const d = def({ raises: "injury", causeShare: { cause: "injury", reference: 0.3 }, ages: [20, 40] });
    const rich = makeCountry({
      health: {
        ...country.health,
        causeMix: {
          ...country.health.causeMix,
          value: {
            bands: [[0, 101]],
            female: [{ injury: 0.05, noncommunicable: 0.95 }],
            male: [{ injury: 0.05, noncommunicable: 0.95 }],
          },
        },
      },
    });
    const poor = makeCountry({
      health: {
        ...country.health,
        causeMix: {
          ...country.health.causeMix,
          value: {
            bands: [[0, 101]],
            female: [{ injury: 0.5, noncommunicable: 0.5 }],
            male: [{ injury: 0.5, noncommunicable: 0.5 }],
          },
        },
      },
    });
    expect(p(d, at(30), poor)).toBeGreaterThan(p(d, at(30), rich));
  });
  it("is never above one half", () => {
    expect(p(def({ onset: 1, poverty: 3 }), at(40, { money: moneyAt(1) }))).toBeLessThanOrEqual(0.5);
  });
});

describe("stepConditions", () => {
  const catalog = createConditionCatalog([def({ id: "a" }), def({ id: "b", ages: [60, 100] })]);
  const roll = (value: number) => ({
    next: () => value,
    int: () => 0,
    chance: () => false,
    weighted: <T>(items: readonly T[]) => items[0]!,
  });
  const step = (person: Person, value: number) => stepConditions(person, country, () => roll(value), catalog);

  it("draws exactly one number per condition, from its own stream", () => {
    const names: string[] = [];
    const draws: number[] = [];
    stepConditions(
      at(30),
      country,
      (id) => {
        names.push(id);
        return { ...roll(0.9), next: () => (draws.push(1), 0.9) };
      },
      catalog,
    );
    expect(names).toEqual(["a", "b"]);
    expect(draws).toHaveLength(2);
  });
  it("starts a condition when the roll is under the chance, with an event and a hit to health", () => {
    const { person, events } = step(at(30), 0.01);
    expect(person.conditions).toEqual([{ id: "a", severity: 1, since: 30 }]);
    expect(events.map((e) => e.id)).toEqual(["health.a.begins"]);
    expect(events[0]!.textKey).toBe("event.condition.a.begins");
    expect(events[0]!.effects).toEqual(expect.arrayContaining([{ condition: "add", id: "a", severity: 1 }]));
    expect(events[0]!.effects.some((e) => "stat" in e && e.stat === "health" && e.add < 0)).toBe(true);
  });
  it("starts nothing when the roll is high", () => {
    const { person, events } = step(at(30), 0.99);
    expect(person.conditions).toEqual([]);
    expect(events).toEqual([]);
  });
  it("worsens a condition the person has when the roll is under the worsening chance, up to severity 3", () => {
    const sick = at(30, { conditions: [has("a", 1)] });
    const worse = step(sick, 0.01);
    expect(worse.events[0]!.effects).toEqual(expect.arrayContaining([{ condition: "add", id: "a", severity: 2 }]));
    const worst = step(at(30, { conditions: [has("a", 3)] }), 0.01);
    expect(worst.events.filter((e) => e.id === "health.a.worsens")).toEqual([]);
  });
  it("eases a condition on a high roll, ending it from severity 1", () => {
    const eased = step(at(30, { conditions: [has("a", 2)] }), 0.99);
    expect(eased.events[0]!.effects).toEqual(expect.arrayContaining([{ condition: "add", id: "a", severity: 1 }]));
    const ended = step(at(30, { conditions: [has("a", 1)] }), 0.99);
    expect(ended.events.map((e) => e.id)).toEqual(["health.a.ends"]);
    expect(ended.events[0]!.effects).toEqual(expect.arrayContaining([{ condition: "remove", id: "a" }]));
  });
  it("leaves a condition alone on a middling roll", () => {
    const { events } = step(at(30, { conditions: [has("a", 2)] }), 0.5);
    expect(events).toEqual([]);
  });
  it("never recovers from a condition that has no recovery", () => {
    const chronic = createConditionCatalog([def({ id: "c", recover: 0, worsen: 0 })]);
    const { events } = stepConditions(at(30, { conditions: [has("c", 2)] }), country, () => roll(0.999), chronic);
    expect(events).toEqual([]);
  });
  it("carries the cause a condition raises into the effect", () => {
    const heart = createConditionCatalog([def({ id: "h", raises: "cardiovascular" })]);
    const { events } = stepConditions(at(30), country, () => roll(0.01), heart);
    expect(events[0]!.effects).toContainEqual({ condition: "add", id: "h", severity: 1, raises: "cardiovascular" });
  });
  it("passes on a sensitivity and help topic", () => {
    const sad = createConditionCatalog([def({ id: "s", sensitivity: "difficult", helpTopic: "suicide" })]);
    const { events } = stepConditions(at(30), country, () => roll(0.01), sad);
    expect(events[0]).toMatchObject({ sensitivity: "difficult", helpTopic: "suicide" });
  });
  it("ignores conditions it has no definition for", () => {
    const { events } = step(at(30, { conditions: [has("mystery", 3)] }), 0.5);
    expect(events).toEqual([]);
  });
});

describe("what conditions cost", () => {
  const cat = createConditionCatalog([
    def({ id: "a", hazard: 0.2, healthPenalty: 3, focusCost: [0, 1, 2] }),
    def({ id: "b", hazard: 0.5, healthPenalty: 1, focusCost: [1, 1, 1] }),
  ]);
  it("sums the hazard by severity and uses 0.35 for a condition it does not know", () => {
    expect(conditionHazard([], cat)).toBe(0);
    expect(conditionHazard([has("a", 2)], cat)).toBeCloseTo(0.4, 9);
    expect(conditionHazard([has("a", 1), has("b", 3)], cat)).toBeCloseTo(0.2 + 1.5, 9);
    expect(conditionHazard([has("unknown", 2)], cat)).toBeCloseTo(0.7, 9);
  });
  it("sums the health norm penalty by severity", () => {
    expect(healthPenalty([has("a", 2), has("b", 1)], cat)).toBe(7);
    expect(healthPenalty([], cat)).toBe(0);
  });
  it("takes focus points from the yearly plan, at most two", () => {
    expect(focusPointsLost([], cat)).toBe(0);
    expect(focusPointsLost([has("a", 1)], cat)).toBe(0);
    expect(focusPointsLost([has("a", 3)], cat)).toBe(2);
    expect(focusPointsLost([has("a", 3), has("b", 1)], cat)).toBe(2);
    expect(focusPointsLost([has("b", 1)], cat)).toBe(1);
  });
});

describe("expectedHazardFactor (HEALTH-004, HEALTH-002)", () => {
  it("is exactly 1 when there are no conditions", () => {
    const none = createConditionCatalog([]);
    for (const age of [0, 40, 100]) expect(expectedHazardFactor(country, "female", age, none)).toBe(1);
  });
  it("is above 1 and grows with age as conditions pile up", () => {
    const f = (age: number) => expectedHazardFactor(country, "male", age, conditionCatalog);
    expect(f(20)).toBeGreaterThan(1);
    expect(f(60)).toBeGreaterThan(f(20));
    expect(f(100)).toBeGreaterThanOrEqual(1);
  });
  it("is larger in a country where its causes are bigger shares of deaths", () => {
    const mix = (injury: number) =>
      makeCountry({
        health: {
          ...country.health,
          causeMix: {
            ...country.health.causeMix,
            value: {
              bands: [[0, 101]],
              female: [{ unintentionalInjury: injury, other: 1 - injury }],
              male: [{ unintentionalInjury: injury, other: 1 - injury }],
            },
          },
        },
      });
    const injuryOnly = createConditionCatalog([conditionCatalog.get("serious_injury")!]);
    expect(expectedHazardFactor(mix(0.3), "male", 30, injuryOnly)).toBeGreaterThan(
      expectedHazardFactor(mix(0.01), "male", 30, injuryOnly),
    );
  });
  it("gives the same answer on every call for a country", () => {
    const first = expectedHazardFactor(country, "female", 50, conditionCatalog);
    expect(expectedHazardFactor(country, "female", 50, conditionCatalog)).toBe(first);
  });
});
