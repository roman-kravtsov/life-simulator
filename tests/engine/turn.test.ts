import { describe, expect, it } from "vitest";
import { resolvePlan } from "../../src/engine/focus";
import { advance, advanceAuto, decisionCard, isQuietYear, newLife, withSettings } from "../../src/engine/life";
import { createCatalog, type EventDef } from "../../src/engine/events";
import type { LifeState, Plan } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa" });
const empty = createCatalog([]);
const continueYear = { kind: "continue" } as const;
const everyYear = { pace: "every-year" } as const;

const ALL = ["infancy", "childhood", "adolescence", "youth", "adulthood", "midlife", "elder"] as const;
const event = (overrides: Partial<EventDef> = {}): EventDef => ({
  id: "test.event",
  stage: [...ALL],
  chance: { kind: "fixed", p: 1 },
  text: "event.test.event",
  ...overrides,
});

const crossroads = event({
  id: "test.crossroads",
  text: "event.test.crossroads",
  conditions: [{ age: [8, 8] }],
  choices: [
    {
      id: "stay",
      text: "choice.test.stay",
      default: true,
      outcomes: [{ p: 1, text: "outcome.test.stay", effects: [{ stat: "belonging", add: 5 }] }],
    },
    {
      id: "go",
      text: "choice.test.go",
      outcomes: [
        { p: 0.5, text: "outcome.test.go_well", lens: "lens.test.well", effects: [{ stat: "skills", add: 9 }] },
        { p: 0.5, text: "outcome.test.go_badly", lens: "lens.test.badly", effects: [{ stat: "happiness", add: -9 }] },
      ],
    },
    {
      id: "far",
      text: "choice.test.far",
      locks: [{ unless: [{ stat: "skills", op: ">", value: 99 }], reason: "lock.test.far" }],
      outcomes: [{ p: 1, text: "outcome.test.far", effects: [] }],
    },
  ],
});

const withCrossroads = createCatalog([crossroads]);
const start = (seed = "turn-1") => newLife({ seed, country, settings: everyYear });

/** Lives until a decision is waiting, or the life ends. */
function toDecision(state: LifeState, catalog = withCrossroads): LifeState {
  let s = state;
  for (let i = 0; i < 40 && !s.turn && s.person.alive; i++) s = advance(s, continueYear, country, catalog).state;
  return s;
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
};

describe("a year that waits for a decision (DEC-001)", () => {
  it("stops with the decision open and the year not yet recorded", () => {
    const waiting = toDecision(start());
    expect(waiting.turn?.decision.eventId).toBe("test.crossroads");
    expect(waiting.turn?.year).toBe(8);
    expect(waiting.person.age).toBe(8);
    expect(waiting.history).toHaveLength(8);
  });
  it("refuses to continue while the decision waits, and to choose when none does", () => {
    const waiting = toDecision(start());
    expect(() => advance(waiting, continueYear, country, withCrossroads)).toThrow(/waiting/);
    expect(() => advance(start(), { kind: "choose", choiceId: "stay" }, country, empty)).toThrow(/No decision/);
  });
  it("applies the choice's outcome, records it on the year and logs the decision", () => {
    const waiting = toDecision(start());
    const after = advance(waiting, { kind: "choose", choiceId: "stay" }, country, withCrossroads).state;
    expect(after.turn).toBeUndefined();
    expect(after.person.age).toBe(9);
    const record = after.history.at(-1)!.events.find((e) => e.id === "test.crossroads")!;
    expect(record.decision).toEqual({
      choiceId: "stay",
      choiceTextKey: "choice.test.stay",
      outcomeTextKey: "outcome.test.stay",
    });
    expect(record.effects[0]?.cause).toBe("choice");
    expect(after.decisions).toEqual([{ year: 8, eventId: "test.crossroads", choiceId: "stay" }]);
  });
  it("tags an outcome that depends on chance as chance", () => {
    const waiting = toDecision(start());
    const after = advance(waiting, { kind: "choose", choiceId: "go" }, country, withCrossroads).state;
    const record = after.history.at(-1)!.events.find((e) => e.id === "test.crossroads")!;
    expect(record.effects.every((e) => e.cause === "chance")).toBe(true);
  });
  it("refuses a locked or unknown choice", () => {
    const waiting = toDecision(start());
    expect(() => advance(waiting, { kind: "choose", choiceId: "far" }, country, withCrossroads)).toThrow(/locked/);
    expect(() => advance(waiting, { kind: "choose", choiceId: "nope" }, country, withCrossroads)).toThrow(/Unknown/);
  });
  it("shows the card with the locked reason and banded odds", () => {
    const card = decisionCard(toDecision(start()), country, withCrossroads)!;
    expect(card.choices.map((c) => c.id)).toEqual(["stay", "go", "far"]);
    expect(card.choices[2]?.lockedReason).toBe("lock.test.far");
    const go = card.choices[1]!;
    expect(go.lens.map((l) => l.key)).toEqual(["lens.test.well", "lens.test.badly"]);
    expect(go.lens[0]?.band).toEqual({ kind: "fraction", num: 1, den: 2 });
  });
  it("carries the data note from the card to the record", () => {
    const noted = createCatalog([
      { ...crossroads, dataNote: { text: "note.unemployment", path: "work.unemployment" } },
    ]);
    const waiting = toDecision(start(), noted);
    expect(decisionCard(waiting, country, noted)?.dataNote?.textKey).toBe("note.unemployment");
    const after = advance(waiting, { kind: "choose", choiceId: "stay" }, country, noted).state;
    const record = after.history.at(-1)!.events.find((e) => e.id === "test.crossroads")!;
    expect(record.dataNote?.value).toBeCloseTo(country.work.unemployment.value);
  });
  it("is replayed exactly from the seed and the decision log", () => {
    const play = () => {
      let s = toDecision(start("replay"));
      s = advance(s, { kind: "choose", choiceId: "go" }, country, withCrossroads).state;
      return advanceAuto(s, country, withCrossroads);
    };
    expect(play()).toEqual(play());
  });
  it("does not change the state it was given", () => {
    const waiting = deepFreeze(toDecision(start()));
    expect(() => advance(waiting, { kind: "choose", choiceId: "stay" }, country, withCrossroads)).not.toThrow();
  });
  it("lets the auto policy take the marked default", () => {
    let s = start();
    for (let i = 0; i < 12; i++) s = advanceAuto(s, country, withCrossroads);
    expect(s.decisions[0]).toMatchObject({ eventId: "test.crossroads", choiceId: "stay" });
  });
  it("holds at most one decision a year", () => {
    const second = event({ ...crossroads, id: "test.second", text: "event.test.second" });
    const catalog = createCatalog([crossroads, second]);
    let s = toDecision(start(), catalog);
    s = advance(s, { kind: "choose", choiceId: "stay" }, country, catalog).state;
    expect(s.history.at(-1)!.events.filter((e) => e.decision)).toHaveLength(1);
  });
});

describe("the yearly plan (DEC-003)", () => {
  const plan = (p: Partial<Plan>): Plan => ({ learn: 0, earn: 0, health: 0, belonging: 0, rest: 0, ...p });
  const at = (age: number) => {
    let s = start("plan-1");
    while (s.person.age < age) s = advanceAuto(s, country, empty);
    return s;
  };
  it("has no plan before age 6", () => {
    const s = advance(at(2), continueYear, country, empty).state;
    expect(s.plan).toBeUndefined();
    expect(s.history.at(-1)?.plan).toBeUndefined();
  });
  it("records the points a year was lived with", () => {
    const s = advance(at(7), continueYear, country, empty).state;
    expect(Object.values(s.history.at(-1)!.plan!).reduce((a, b) => a + b, 0)).toBe(3);
  });
  it("keeps the chosen plan until the player changes it", () => {
    const chosen = plan({ rest: 2, belonging: 1 });
    let s = advance(at(7), { kind: "continue", plan: chosen }, country, empty).state;
    expect(s.plan).toEqual({ points: chosen, custom: true });
    s = advance(s, continueYear, country, empty).state;
    expect(s.history.at(-1)!.plan).toEqual(chosen);
  });
  it("refuses a plan that overspends, underspends or uses a locked area", () => {
    const s = at(8);
    expect(() => advance(s, { kind: "continue", plan: plan({ rest: 4 }) }, country, empty)).toThrow(/plan/);
    expect(() => advance(s, { kind: "continue", plan: plan({ rest: 2 }) }, country, empty)).toThrow(/plan/);
    expect(() => advance(s, { kind: "continue", plan: plan({ earn: 3 }) }, country, empty)).toThrow(/plan/);
  });
  it("shifts the odds: a life spent on health outlives one spent resting, on average", () => {
    const stats = (area: keyof Plan) => {
      let total = 0;
      for (let i = 0; i < 40; i++) {
        let s = newLife({ seed: `plan-${i}`, country, settings: everyYear });
        while (s.person.age < 6) s = advanceAuto(s, country, empty);
        s = advance(s, { kind: "continue", plan: plan({ [area]: resolvePlan(s.person).free }) }, country, empty).state;
        while (s.person.age < 40 && s.person.alive) s = advanceAuto(s, country, empty);
        total += s.person.stats.health;
      }
      return total / 40;
    };
    expect(stats("health")).toBeGreaterThan(stats("rest"));
  });
});

describe("quiet years (TIME-002)", () => {
  const quiet = createCatalog([
    event({ id: "test.quiet", text: "event.test.quiet", quiet: true, chance: { kind: "fixed", p: 1 } }),
  ]);
  it("runs through quiet years in one step when the pace says so", () => {
    const batched = advance(newLife({ seed: "q", country }), continueYear, country, quiet).state;
    expect(batched.history.length).toBeGreaterThan(1);
    expect(batched.history.length).toBeLessThanOrEqual(12);
  });
  it("lives one year at a time when the pace is every year", () => {
    expect(advance(start("q"), continueYear, country, quiet).state.history).toHaveLength(1);
  });
  it("stops at a year with an event worth telling", () => {
    const loud = createCatalog([event({ id: "test.loud", text: "event.test.loud", conditions: [{ age: [5, 5] }] })]);
    const s = advance(newLife({ seed: "q", country }), continueYear, country, loud).state;
    expect(s.person.age).toBeLessThanOrEqual(6);
    expect(isQuietYear(s.history.at(-1)!)).toBe(false);
  });
});

describe("softening (EVENT-006)", () => {
  const hard = event({
    id: "test.hard",
    text: "event.test.hard",
    softText: "event.test.hard.soft",
    sensitivity: "difficult",
    helpTopic: "grief",
  });
  it("tells a hard event in its shorter words when softening is on", () => {
    const soft = newLife({ seed: "s", country, settings: { ...everyYear, softening: true } });
    const record = advance(soft, continueYear, country, createCatalog([hard])).state.history[0]!.events[0]!;
    expect(record.textKey).toBe("event.test.hard.soft");
    expect(record.helpTopic).toBe("grief");
  });
  it("tells it in full otherwise", () => {
    const record = advance(start("s"), continueYear, country, createCatalog([hard])).state.history[0]!.events[0]!;
    expect(record.textKey).toBe("event.test.hard");
  });
  it("leaves out severe narrative events", () => {
    const severe = event({
      id: "test.severe",
      text: "event.test.severe",
      sensitivity: "severe",
      chance: { kind: "weight", base: 100 },
      tier: "major",
    });
    const catalog = createCatalog([severe]);
    const off = newLife({ seed: "s", country, settings: everyYear });
    const on = newLife({ seed: "s", country, settings: { ...everyYear, softening: true } });
    let seen = false;
    let s = off;
    for (let i = 0; i < 30; i++) {
      s = advanceAuto(s, country, catalog);
      seen ||= s.history.some((h) => h.events.some((e) => e.id === "test.severe"));
    }
    expect(seen).toBe(true);
    s = on;
    for (let i = 0; i < 30; i++) s = advanceAuto(s, country, catalog);
    expect(s.history.some((h) => h.events.some((e) => e.id === "test.severe"))).toBe(false);
  });
});

describe("follow-up events (EVENT-004)", () => {
  const first = event({
    id: "test.first",
    text: "event.test.first",
    conditions: [{ age: [3, 3] }],
    effects: [{ schedule: "test.later", inYears: 2 }],
  });
  const later = event({ id: "test.later", text: "event.test.later", chance: { kind: "scheduled" } });
  it("comes when it is due, and not before", () => {
    const catalog = createCatalog([first, later]);
    let s = start("f");
    const seen: Record<string, number> = {};
    for (let i = 0; i < 8; i++) {
      s = advanceAuto(s, country, catalog);
      for (const h of s.history) for (const e of h.events) seen[e.id] ??= h.age - 1;
    }
    expect(seen["test.first"]).toBe(3);
    expect(seen["test.later"]).toBe(5);
  });
  it("is used up once it has happened", () => {
    const catalog = createCatalog([first, later]);
    let s = start("f");
    for (let i = 0; i < 12; i++) s = advanceAuto(s, country, catalog);
    expect(s.history.flatMap((h) => h.events).filter((e) => e.id === "test.later")).toHaveLength(1);
    expect(s.person.scheduled).toEqual([]);
  });
});

describe("settings (EVENT-006, TIME-002)", () => {
  it("can be changed between years without touching the rest of the life", () => {
    const life = start("settings");
    const changed = withSettings(life, { softening: true });
    expect(changed.settings).toEqual({ softening: true, pace: "every-year" });
    expect({ ...changed, settings: life.settings, settingsLog: undefined }).toEqual({
      ...life,
      settingsLog: undefined,
    });
    expect(life.settings.softening).toBe(false);
  });
  it("records each plan the player sets, so a replay can apply it", () => {
    let life = start("plan-log");
    while (life.person.age < 6) life = advanceAuto(life, country);
    const chosen: Plan = { learn: resolvePlan(life.person, life.plan).free, earn: 0, health: 0, belonging: 0, rest: 0 };
    const after = advance(life, { kind: "continue", plan: chosen }, country).state;
    expect(after.planLog).toEqual([{ age: life.person.age, plan: chosen }]);
    expect(advanceAuto(after, country).planLog).toEqual(after.planLog);
    expect(life.planLog).toBeUndefined();
  });
  it("logs a change made while a decision waits at the next age, since that year's events are chosen", () => {
    const waiting = toDecision(start("settings-turn"));
    expect(waiting.turn).toBeDefined();
    expect(withSettings(waiting, { softening: true }).settingsLog).toEqual([
      { age: waiting.person.age + 1, changes: { softening: true } },
    ]);
  });
  it("records each change with the age it was made at, so a replay can apply it", () => {
    const life = start("settings-log");
    const aged = advanceAuto(advanceAuto(life, country), country);
    const changed = withSettings(withSettings(aged, { softening: true }), { pace: "quiet-years" });
    expect(changed.settingsLog).toEqual([
      { age: aged.person.age, changes: { softening: true } },
      { age: aged.person.age, changes: { pace: "quiet-years" } },
    ]);
    expect(life.settingsLog).toBeUndefined();
  });
});
