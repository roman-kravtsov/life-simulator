import { describe, expect, it } from "vitest";
import { advance, newLife, type NewLifeOptions } from "../../src/engine/life";
import { createCatalog, type EventDef } from "../../src/engine/events";
import type { LifeState } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa" });
const start = (seed = "life-1", c = country) => newLife({ seed, country: c } satisfies NewLifeOptions);
const input = { kind: "continue" } as const;
const empty = createCatalog([]);

function run(state: LifeState, catalog = empty, c = country): LifeState {
  let s = state;
  let guard = 0;
  while (s.person.alive) {
    s = advance(s, input, c, catalog).state;
    if (++guard > 200) throw new Error("life did not end");
  }
  return s;
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
};

const event = (overrides: Partial<EventDef> = {}): EventDef => ({
  id: "test.event",
  stage: ["infancy", "childhood", "adolescence", "youth", "adulthood", "midlife", "elder"],
  chance: { kind: "fixed", p: 1 },
  text: "event.test.event",
  ...overrides,
});

describe("newLife", () => {
  it("starts a newborn with an empty history and the seed", () => {
    const life = start();
    expect(life.seed).toBe("life-1");
    expect(life.person.age).toBe(0);
    expect(life.history).toEqual([]);
    expect(life.death).toBeUndefined();
  });
  it("is deterministic", () => {
    expect(start("same")).toEqual(start("same"));
    expect(start("one").person).not.toEqual(start("two").person);
  });
});

describe("advance: the yearly turn (SIM-002, TIME-001)", () => {
  it("moves exactly one year per call and records it", () => {
    const first = advance(start(), input, country, empty).state;
    expect(first.person.age).toBe(1);
    expect(first.history).toHaveLength(1);
    expect(first.history[0]).toMatchObject({ age: 1, stage: "infancy", stageChanged: false });
    const second = advance(first, input, country, empty).state;
    expect(second.person.age).toBe(2);
    expect(second.history).toHaveLength(2);
  });
  it("marks a new stage when a birthday crosses into it", () => {
    let s = start("stages");
    const ages: number[] = [];
    while (s.person.alive && s.person.age < 20) {
      s = advance(s, input, country, empty).state;
      if (s.history.at(-1)!.stageChanged) ages.push(s.history.at(-1)!.age);
    }
    expect(ages.slice(0, 3)).toEqual([3, 12, 18].slice(0, ages.length));
  });
  it("does not change the state it is given", () => {
    const state = deepFreeze(start("frozen"));
    expect(() =>
      advance(state, input, country, createCatalog([event({ effects: [{ stat: "bonds", add: 3 }] })])),
    ).not.toThrow();
  });
  it("refuses to advance a life that has ended", () => {
    const dead = run(start("dead"));
    expect(() => advance(dead, input, country, empty)).toThrow(/ended/);
  });
  it("rejects an unknown input", () => {
    // @ts-expect-error testing a bad input on purpose
    expect(() => advance(start(), { kind: "nope" }, country, empty)).toThrow(/Unknown input/);
  });
});

describe("a life from birth to death with no player input", () => {
  it("ends in death by age 100 with a cause, and the last record says so", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const life = run(start(seed));
      expect(life.person.alive).toBe(false);
      expect(life.death).toBeDefined();
      expect(life.death!.age).toBe(life.person.age);
      expect(life.death!.age).toBeLessThanOrEqual(100);
      expect(typeof life.death!.cause).toBe("string");
      const last = life.history.at(-1)!;
      expect(last.died).toBe(true);
      expect(last.age).toBe(life.death!.age);
      expect(life.history.filter((r) => r.died)).toHaveLength(1);
    }
  });
  it("keeps every stat in range in every recorded year", () => {
    const life = run(start("range"));
    for (const record of life.history)
      for (const v of Object.values(record.stats)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
  });
  it("replays exactly from the same seed", () => {
    expect(run(start("replay"))).toEqual(run(start("replay")));
  });
  it("differs between seeds", () => {
    const deaths = new Set(["s1", "s2", "s3", "s4", "s5", "s6"].map((s) => run(start(s)).death!.age));
    expect(deaths.size).toBeGreaterThan(1);
  });
});

describe("turn steps", () => {
  it("drift: stats move between years even with no events", () => {
    const life = advance(start("drift"), input, country, empty).state;
    expect(life.history[0]!.stats).not.toEqual(start("drift").person.stats);
  });
  it("events: an event that always fires lands in the record with its effects tagged by cause", () => {
    const catalog = createCatalog([event({ effects: [{ stat: "bonds", add: 3 }], cause: "circumstance" })]);
    const record = advance(start("events"), input, country, catalog).state.history[0]!;
    expect(record.events.map((e) => e.id)).toEqual(["test.event"]);
    expect(record.events[0]!.textKey).toBe("event.test.event");
    expect(record.events[0]!.effects).toEqual([
      { effect: { stat: "bonds", add: 3 }, cause: "circumstance", delta: expect.any(Number) },
    ]);
  });
  it("effects: event effects change the stats after drift", () => {
    const plain = advance(start("fx"), input, country, empty).state.person.stats.bonds;
    const boosted = advance(
      start("fx"),
      input,
      country,
      createCatalog([event({ effects: [{ stat: "bonds", add: 5 }] })]),
    ).state.person.stats.bonds;
    expect(boosted).toBeGreaterThan(plain);
  });
  it("effects: an event can set a story flag", () => {
    const catalog = createCatalog([event({ effects: [{ set: "saw_the_sea", value: true }] })]);
    expect(advance(start("flag"), input, country, catalog).state.person.flags.saw_the_sea).toBe(true);
  });
  it("effects: resilience softens a setback and low resilience deepens it", () => {
    const hit = createCatalog([event({ effects: [{ stat: "wellbeing", add: -10 }] })]);
    const withResilience = (value: number): LifeState => {
      const life = start("res");
      return { ...life, person: { ...life.person, traits: { ...life.person.traits, resilience: value } } };
    };
    const after = (value: number) => advance(withResilience(value), input, country, hit).state.person.stats.wellbeing;
    expect(after(2)).toBeGreaterThan(after(-2));
  });
  it("the events stream is separate from mortality: adding an event that changes nothing does not move the death", () => {
    const neutral = createCatalog([event({ id: "neutral", chance: { kind: "weight", base: 4 }, tier: "minor" })]);
    for (const seed of ["m1", "m2", "m3"]) {
      expect(run(start(seed), neutral).death).toEqual(run(start(seed)).death);
    }
  });
  it("mortality: the person can die in any year, and a death in infancy records age 0", () => {
    const deadly = makeCountry({
      region: "Western Africa",
      demography: {
        ...country.demography,
        lifeTable: {
          ...country.demography.lifeTable,
          value: { female: [1, ...new Array<number>(100).fill(1)], male: [1, ...new Array<number>(100).fill(1)] },
        },
      },
    });
    const life = advance(start("deadly", deadly), input, deadly, empty).state;
    expect(life.person.alive).toBe(false);
    expect(life.death!.age).toBe(0);
    expect(life.person.age).toBe(0);
  });
});

describe("family in the yearly turn (FAM-003)", () => {
  it("ages the parents with the child", () => {
    const life = start("fam");
    const next = advance(life, input, country, empty).state;
    const before = life.person.relationships.find((r) => r.kind === "mother")!;
    const after = next.person.relationships.find((r) => r.kind === "mother")!;
    if (after.alive) expect(after.age).toBe(before.age + 1);
  });
  it("records a parent's death as an event, sets a flag and hurts bonds and wellbeing", () => {
    const base = start("grief");
    const mother = { ...base.person.relationships[0]!, age: 99, closeness: 90 };
    const grieving: LifeState = {
      ...base,
      person: { ...base.person, age: 14, stage: "adolescence", relationships: [mother, base.person.relationships[1]!] },
    };
    let s = grieving;
    for (let i = 0; i < 12 && s.person.alive; i++) {
      s = advance(s, input, country, empty).state;
      const found = s.history.at(-1)!.events.find((e) => e.id === "family.mother_died");
      if (found) {
        expect(found.sensitivity).toBe("difficult");
        expect(found.helpTopic).toBe("grief");
        expect(found.vars).toEqual({ name: mother.name });
        expect(s.person.flags.lost_mother).toBe(true);
        expect(found.effects.some((e) => "stat" in e.effect && e.effect.stat === "bonds" && (e.delta ?? 0) < 0)).toBe(
          true,
        );
        expect(found.effects.every((e) => e.cause === "chance")).toBe(true);
        return;
      }
    }
    throw new Error("the mother never died");
  });
});

describe("child labour in the yearly turn", () => {
  it("records when a child starts work and sets the flag", () => {
    const poor = makeCountry({
      region: "Western Africa",
      work: { ...country.work, childLabour: { ...country.work.childLabour, value: 0.9 } },
    });
    let found = false;
    for (let i = 0; i < 30 && !found; i++) {
      let s = start(`lab${i}`, poor);
      s = { ...s, person: { ...s.person, money: { ...s.person.money, householdPercentile: 1 } } };
      while (s.person.alive && s.person.age < 15) {
        s = advance(s, input, poor, empty).state;
        if (s.history.at(-1)!.events.some((e) => e.id === "check.child_labour_starts")) {
          expect(s.person.flags.childLabour).toBe(true);
          expect(
            s.history
              .at(-1)!
              .events.find((e) => e.id === "check.child_labour_starts")!
              .effects.every((e) => e.cause === "circumstance"),
          ).toBe(true);
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });
  it("clears the flag at 15", () => {
    const poor = makeCountry({
      region: "Western Africa",
      work: { ...country.work, childLabour: { ...country.work.childLabour, value: 0.9 } },
    });
    let s = start("lab-end", poor);
    s = { ...s, person: { ...s.person, money: { ...s.person.money, householdPercentile: 1 } } };
    while (s.person.alive && s.person.age < 16) s = advance(s, input, poor, empty).state;
    if (s.person.alive) expect(s.person.flags.childLabour).toBeFalsy();
  });
});

describe("event cooldowns count years lived", () => {
  const immortal = makeCountry({
    region: "Western Africa",
    demography: {
      ...country.demography,
      lifeTable: {
        ...country.demography.lifeTable,
        value: {
          female: [...new Array<number>(100).fill(0), 1],
          male: [...new Array<number>(100).fill(0), 1],
        },
      },
    },
  });
  const firedAges = (cooldownYears: number) => {
    let s = start("cooldown", immortal);
    const catalog = createCatalog([event({ cooldownYears })]);
    const ages: number[] = [];
    for (let i = 0; i < 8; i++) {
      s = advance(s, input, immortal, catalog).state;
      const record = s.history.at(-1)!;
      if (record.events.some((e) => e.id === "test.event")) ages.push(record.age);
    }
    return ages;
  };
  it("a cooldown of 1 allows the event every year and 2 every other year", () => {
    expect(firedAges(1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(firedAges(2)).toEqual([1, 3, 5, 7]);
  });
});
