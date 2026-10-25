import { describe, expect, it, vi } from "vitest";
import { adultPercentile, dailyIncome } from "../../src/engine/money";
import { SEED_PATTERN } from "../../src/engine/seed";
import { DEFAULT_SETTINGS, type LifeState, type Person, type Relationship } from "../../src/engine/types";
import { browserSeed, closenessBand, createGameStore, lifeOverview, planToSend } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { adultAt, makePerson, moneyAt } from "../fixtures/person";

const seeds = () => {
  let n = 0;
  return () => `seed-${n++}`;
};

const setup = () => createGameStore(seeds(), testWorld());

describe("game store", () => {
  it("starts on the start screen with no life", () => {
    expect(setup().getSnapshot()).toMatchObject({ screen: "start", life: null, country: null, status: "idle" });
  });

  it("begins a life: loads the world, draws the country and shows the birth screen", async () => {
    const store = setup();
    const done = store.begin();
    expect(store.getSnapshot().status).toBe("loading");
    await done;
    const { screen, life, country, status } = store.getSnapshot();
    expect(screen).toBe("birth");
    expect(status).toBe("idle");
    expect(country?.iso3).toBe("AAA");
    expect(life?.person.age).toBe(0);
    expect(life?.person.countryIso3).toBe("AAA");
    expect(life?.seed).toBe("seed-0");
  });

  it("moves from the birth screen into the first year", async () => {
    const store = setup();
    await store.begin();
    store.startLife();
    expect(store.getSnapshot().screen).toBe("life");
    expect(store.getSnapshot().life?.person.age).toBe(0);
  });

  it("advances the life one year on continue and nothing else moves it (TIME-001)", async () => {
    const store = setup();
    await store.begin();
    store.startLife();
    store.continueYear();
    expect(store.getSnapshot().life?.history).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getSnapshot().life?.history).toHaveLength(1);
  });

  it("stops advancing once the person has died", async () => {
    const store = setup();
    await store.begin();
    store.startLife();
    for (let i = 0; i < 240 && store.getSnapshot().life?.person.alive; i++) {
      const { card } = store.getSnapshot();
      if (card) store.choose(card.choices.find((c) => !c.lockedReason)!.id);
      else store.continueYear();
    }
    const ended = store.getSnapshot();
    expect(ended.life?.person.alive).toBe(false);
    store.continueYear();
    expect(store.getSnapshot()).toBe(ended);
  });

  it("returns to the start screen", async () => {
    const store = setup();
    await store.begin();
    store.backToStart();
    expect(store.getSnapshot()).toMatchObject({ screen: "start", life: null, country: null });
  });

  it("can begin another life after one ends, with a new seed", async () => {
    const store = setup();
    await store.begin();
    await store.begin();
    expect(store.getSnapshot().life?.seed).toBe("seed-1");
  });

  it("shows an error and lets the player try again when the world fails to load", async () => {
    const world = testWorld();
    const loadIndex = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(world.loadIndex);
    const store = createGameStore(seeds(), { ...world, loadIndex });
    await store.begin();
    expect(store.getSnapshot()).toMatchObject({ screen: "start", status: "error" });
    await store.begin();
    expect(store.getSnapshot().screen).toBe("birth");
  });

  it("ignores a load that finishes after the player went back", async () => {
    const world = testWorld();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const store = createGameStore(seeds(), { ...world, loadIndex: () => gate.then(world.loadIndex) });
    const done = store.begin();
    store.backToStart();
    release();
    await done;
    expect(store.getSnapshot().screen).toBe("start");
  });

  it("ignores a second begin while one is loading", async () => {
    const world = testWorld();
    const loadIndex = vi.fn(world.loadIndex);
    const store = createGameStore(seeds(), { ...world, loadIndex });
    await Promise.all([store.begin(), store.begin()]);
    expect(loadIndex).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on change and stops after unsubscribe", async () => {
    const store = setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    await store.begin();
    const calls = listener.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    unsubscribe();
    store.startLife();
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it("keeps a stable snapshot between changes", () => {
    const store = setup();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("ignores continue when no life is in progress", () => {
    const store = setup();
    const before = store.getSnapshot();
    store.continueYear();
    expect(store.getSnapshot()).toBe(before);
  });

  it("opens and closes the sources screen without a life", () => {
    const store = setup();
    store.openSources();
    expect(store.getSnapshot()).toMatchObject({ screen: "sources", life: null });
    store.closeSources();
    expect(store.getSnapshot()).toMatchObject({ screen: "start", life: null });
  });

  it("starts with US prices off, toggles them, and keeps the choice across lives (MONEY-007)", async () => {
    const store = setup();
    expect(store.getSnapshot().showUsPrices).toBe(false);
    store.toggleUsPrices();
    expect(store.getSnapshot().showUsPrices).toBe(true);
    await store.begin();
    expect(store.getSnapshot().showUsPrices).toBe(true);
    store.backToStart();
    store.openSources();
    store.closeSources();
    expect(store.getSnapshot().showUsPrices).toBe(true);
    store.toggleUsPrices();
    expect(store.getSnapshot().showUsPrices).toBe(false);
  });
});

describe("game store: plan, decisions and settings (DEC-001, DEC-003, EVENT-006, TIME-002)", () => {
  const atDecision = async (seed: string) => {
    const store = createGameStore(() => seed, testWorld(makeCountry({ region: "Western Africa" })));
    await store.begin();
    store.startLife();
    while (store.getSnapshot().life?.person.alive && !store.getSnapshot().card) store.continueYear();
    return store;
  };

  it("starts with the default settings, which a new life carries", async () => {
    const store = setup();
    expect(store.getSnapshot().settings).toEqual({ softening: false, pace: "quiet-years" });
    await store.begin();
    expect(store.getSnapshot().life?.settings).toEqual({ softening: false, pace: "quiet-years" });
  });

  it("keeps settings across lives and applies a change to the life in progress", async () => {
    const store = setup();
    store.setSettings({ softening: true });
    await store.begin();
    expect(store.getSnapshot().life?.settings.softening).toBe(true);
    store.startLife();
    store.setSettings({ pace: "every-year" });
    expect(store.getSnapshot().settings).toEqual({ softening: true, pace: "every-year" });
    expect(store.getSnapshot().life?.settings).toEqual({ softening: true, pace: "every-year" });
    store.backToStart();
    await store.begin();
    expect(store.getSnapshot().life?.settings).toEqual({ softening: true, pace: "every-year" });
  });

  it("offers the plan from age six, with what the player places, and nothing before", async () => {
    const store = setup();
    store.setSettings({ pace: "every-year" });
    await store.begin();
    store.startLife();
    expect(store.getSnapshot().plan).toBeNull();
    for (let i = 0; i < 6; i++) store.continueYear();
    const { plan, life, card } = store.getSnapshot();
    expect(life?.person.alive).toBe(true);
    expect(card).toBeNull();
    expect(plan).toMatchObject({ free: 3, custom: false });
    expect(Object.values(plan!.chosen).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("sends the plan to the engine, keeps it for the years after, and rejects one that does not fit", async () => {
    const store = setup();
    store.setSettings({ pace: "every-year" });
    await store.begin();
    store.startLife();
    for (let i = 0; i < 6; i++) store.continueYear();
    const plan = store.getSnapshot().plan!;
    expect(plan).not.toBeNull();
    const placed = { learn: 0, earn: 0, health: 0, belonging: 0, rest: plan.free };
    expect(() => store.continueYear({ ...placed, learn: 9 })).toThrow(/plan/);
    store.continueYear(placed);
    expect(store.getSnapshot().life?.plan).toEqual({ points: placed, custom: true });
    expect(store.getSnapshot().life?.history.at(-1)?.plan?.rest).toBeGreaterThanOrEqual(plan.free);
  });

  it("holds the year at a decision: the card is derived, continue is ignored, the plan is withheld", async () => {
    const store = await atDecision("seed-3");
    const before = store.getSnapshot();
    expect(before.card?.eventId).toBe("edu.higher_education");
    expect(before.plan).toBeNull();
    store.continueYear();
    expect(store.getSnapshot()).toBe(before);
  });

  it("answers a decision: logs the choice, finishes the year and clears the card", async () => {
    const store = await atDecision("seed-3");
    const years = store.getSnapshot().life!.history.length;
    store.choose("work");
    const { life, card } = store.getSnapshot();
    expect(card).toBeNull();
    expect(life?.turn).toBeUndefined();
    expect(life?.decisions).toEqual([{ year: 17, eventId: "edu.higher_education", choiceId: "work" }]);
    expect(life?.history).toHaveLength(years + 1);
    expect(life?.history.at(-1)?.events.at(-1)?.decision?.choiceId).toBe("work");
  });

  it("ignores a locked or unknown choice, and choose when nothing is waiting", async () => {
    const store = await atDecision("seed-3");
    const waiting = store.getSnapshot();
    store.choose("scholarship"); // locked: the results are not strong enough
    store.choose("no-such-choice");
    expect(store.getSnapshot()).toBe(waiting);
    store.choose("work");
    const done = store.getSnapshot();
    store.choose("work");
    expect(store.getSnapshot()).toBe(done);
  });

  it("tells which years passed quietly, including the ones before a decision", async () => {
    const store = createGameStore(() => "seed-0", testWorld(makeCountry({ region: "Western Africa" })));
    await store.begin();
    store.startLife();
    let seen = false;
    for (let i = 0; i < 40 && store.getSnapshot().life?.person.alive; i++) {
      const before = store.getSnapshot().life!.history.length;
      const { card } = store.getSnapshot();
      if (card) store.choose(card.choices.find((c) => !c.lockedReason)!.id);
      else store.continueYear();
      const { life, quietRun } = store.getSnapshot();
      const added = life!.history.length - before;
      if (!life!.turn && added > 1) {
        expect(quietRun).toEqual({ from: life!.history[before]!.age, to: life!.history.at(-2)!.age });
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });
});

const relative = (overrides: Partial<Relationship>): Relationship => ({
  id: "r",
  kind: "sibling",
  name: "Test",
  sex: "female",
  age: 10,
  alive: true,
  closeness: 50,
  ...overrides,
});

const lifeOf = (overrides: Partial<Person>): LifeState => ({
  seed: "test",
  person: makePerson(overrides),
  history: [],
  settings: DEFAULT_SETTINGS,
  decisions: [],
});

describe("lifeOverview (REL-001, MONEY-007 and the display side of EDU, CAREER, HEALTH)", () => {
  // Synthetic table: the percentile p earns 1 + (p - 1) * 0.5 dollars a day.
  const country = makeCountry();

  it("describes school by level, whether the person is in school, and years", () => {
    const at = (age: number, education: Person["education"]) => lifeOverview(lifeOf({ age, education }), country);
    expect(at(3, { level: "none", inSchool: false, years: 0 }).education).toEqual({ kind: "too-young" });
    expect(at(7, { level: "none", inSchool: true, years: 1 }).education).toEqual({
      kind: "attending",
      level: "primary",
      years: 1,
    });
    expect(at(20, { level: "upper-secondary", inSchool: true, years: 12 }).education).toEqual({
      kind: "attending",
      level: "tertiary",
      years: 12,
    });
    expect(at(13, { level: "primary", inSchool: false, years: 6 }).education).toEqual({
      kind: "completed",
      level: "primary",
      years: 6,
    });
    expect(at(30, { level: "tertiary", inSchool: false, years: 16 }).education).toMatchObject({
      kind: "completed",
      level: "tertiary",
    });
    expect(at(10, { level: "none", inSchool: false, years: 2 }).education).toEqual({
      kind: "left-early",
      level: "primary",
      years: 2,
    });
    expect(at(6, { level: "none", inSchool: false, years: 0 }).education).toEqual({ kind: "too-young" });
    expect(at(7, { level: "none", inSchool: false, years: 0 }).education).toEqual({ kind: "never" });
    expect(at(12, { level: "none", inSchool: false, years: 0 }).education).toEqual({ kind: "never" });
  });

  it("reports reading from age 15, when it is known", () => {
    const read = (age: number, literate?: boolean) =>
      lifeOverview(lifeOf({ age, education: { level: "none", inSchool: false, years: 0, literate } }), country)
        .literacy;
    expect(read(14, true)).toBeNull();
    expect(read(15, true)).toBe("literate");
    expect(read(40, false)).toBe("illiterate");
    expect(read(40, undefined)).toBeNull();
  });

  it("describes work in words, with nothing under six", () => {
    const work = (age: number, w: Partial<Person["work"]>, inSchool = false) =>
      lifeOverview(
        lifeOf({
          age,
          education: { level: "none", inSchool, years: 0 },
          work: { status: "child", yearsWorked: 0, attachment: 0.5, ...w },
        }),
        country,
      ).work;
    expect(work(5, {})).toBeNull();
    expect(work(10, {})).toMatchObject({ kind: "too-young" });
    expect(work(16, {})).toMatchObject({ kind: "at-home" });
    expect(work(16, { status: "student" }, true)).toMatchObject({ kind: "student" });
    expect(work(30, { status: "employed", sector: "industry", formal: true, yearsWorked: 8 })).toEqual({
      kind: "working",
      sector: "industry",
      formal: true,
      yearsWorked: 8,
    });
    expect(work(30, { status: "informal", sector: "agriculture", formal: false })).toMatchObject({
      kind: "working",
      sector: "agriculture",
      formal: false,
    });
    expect(work(30, { status: "unemployed" })).toMatchObject({ kind: "unemployed" });
    expect(work(30, { status: "caregiver" })).toMatchObject({ kind: "caregiver" });
    expect(work(70, { status: "retired", yearsWorked: 40 })).toMatchObject({ kind: "retired", yearsWorked: 40 });
  });

  it("gives the daily and yearly income per person, the band, and the year of the data", () => {
    const { money } = lifeOverview({ ...lifeOf({}), person: adultAt(11, country) }, country);
    expect(money.daily).toBeCloseTo(6); // 1 + 10 * 0.5
    expect(money.yearly).toBeCloseTo(6 * 365);
    expect(money.band).toBe("low");
    expect(money.year).toBe(2023);
    expect(money.own).toBe(true);
  });

  it("shows a retired person's reduced income as the same figure per day and per year", () => {
    const base = lifeOverview(lifeOf({ age: 40, money: moneyAt(41) }), country).money;
    const retired = lifeOverview(
      lifeOf({
        age: 70,
        money: moneyAt(41),
        work: { status: "retired", yearsWorked: 40, attachment: 0.5 },
      }),
      country,
    ).money;
    expect(retired.daily).toBeLessThan(base.daily);
    expect(retired.daily * 365).toBeCloseTo(retired.yearly);
  });

  it("shows savings and debt only for independent adults, and the household's income for the young", () => {
    const money = moneyAt(50, { savings: 1200, debt: 300 });
    expect(lifeOverview(lifeOf({ age: 30, money }), country).money.holdings).toEqual({ savings: 1200, debt: 300 });
    const child = lifeOverview(lifeOf({ age: 10, money }), country).money;
    expect(child.holdings).toBeNull();
    expect(child.own).toBe(false);
    const student = lifeOverview(
      lifeOf({
        age: 19,
        money,
        education: { level: "upper-secondary", inSchool: true, years: 12 },
        work: { status: "student", yearsWorked: 0, attachment: 0.5 },
      }),
      country,
    ).money;
    expect(student.holdings).toBeNull();
    expect(student.own).toBe(false);
  });

  it("shows the person's own standing from the day they are independent and out of school", () => {
    const person = makePerson({
      age: 18,
      money: moneyAt(80, { luck: -3 }),
      education: { level: "lower-secondary", inSchool: false, years: 9 },
      work: { status: "informal", sector: "agriculture", formal: false, yearsWorked: 0, attachment: 0.1 },
    });
    const { money } = lifeOverview({ ...lifeOf({}), person }, country);
    expect(money.own).toBe(true);
    expect(money.daily).toBeCloseTo(dailyIncome(country, adultPercentile(person, country)));
    expect(money.daily).toBeLessThan(dailyIncome(country, 80));
  });

  it("lists conditions with their severity and onset", () => {
    expect(lifeOverview(lifeOf({}), country).conditions).toEqual([]);
    const { conditions } = lifeOverview(lifeOf({ conditions: [{ id: "malaria", severity: 2, since: 7 }] }), country);
    expect(conditions).toEqual([{ id: "malaria", severity: 2, since: 7 }]);
  });

  it("carries a condition's help topic, so help stays with it while it lasts", () => {
    const { conditions } = lifeOverview(
      lifeOf({
        conditions: [
          { id: "depression", severity: 1, since: 20 },
          { id: "malaria", severity: 1, since: 7 },
        ],
      }),
      country,
    );
    expect(conditions.find((c) => c.id === "depression")?.helpTopic).toBe("suicide");
    expect(conditions.find((c) => c.id === "malaria")?.helpTopic).toBeUndefined();
  });

  it("sorts relatives: parents, then siblings oldest first, then others", () => {
    const { family } = lifeOverview(
      lifeOf({
        relationships: [
          relative({ id: "friend", kind: "friend", age: 9 }),
          relative({ id: "young", age: 3 }),
          relative({ id: "father", kind: "father", age: 40 }),
          relative({ id: "old", age: 14 }),
          relative({ id: "mother", kind: "mother", age: 38 }),
          relative({ id: "mid", age: 8, alive: false }),
          relative({ id: "partner", kind: "partner", age: 30 }),
        ],
      }),
      country,
    );
    expect(family.parents.map((r) => r.id)).toEqual(["mother", "father"]);
    expect(family.siblings.map((r) => r.id)).toEqual(["old", "mid", "young"]);
    expect(family.others.map((r) => r.id)).toEqual(["friend", "partner"]);
  });

  it("does not change the life it reads", () => {
    const life = lifeOf({ relationships: [relative({ id: "b", age: 2 }), relative({ id: "a", age: 9 })] });
    lifeOverview(life, country);
    expect(life.person.relationships.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("closenessBand (FAM-002)", () => {
  it("uses the thresholds 80, 60, 40 and 20", () => {
    expect(closenessBand(100)).toBe("very-close");
    expect(closenessBand(80)).toBe("very-close");
    expect(closenessBand(79)).toBe("close");
    expect(closenessBand(60)).toBe("close");
    expect(closenessBand(59)).toBe("friendly");
    expect(closenessBand(40)).toBe("friendly");
    expect(closenessBand(39)).toBe("distant");
    expect(closenessBand(20)).toBe("distant");
    expect(closenessBand(19)).toBe("strained");
    expect(closenessBand(0)).toBe("strained");
  });
});

describe("browserSeed (RNG-003)", () => {
  it("makes a readable seed", () => {
    expect(browserSeed()).toMatch(SEED_PATTERN);
  });
});

describe("planToSend", () => {
  const plan = {
    areas: ["learn", "earn", "health", "belonging", "rest"] as const,
    free: 3,
    chosen: { learn: 1, earn: 0, health: 1, belonging: 1, rest: 0 },
    forced: [],
    locked: {},
    custom: false,
  };

  it("counts a value that is not a number as 0, so the plan still spends the points available", () => {
    expect(planToSend(plan, { learn: Number.NaN, earn: 0, health: 1, belonging: 1, rest: 0 })).toEqual({
      learn: 0,
      earn: 0,
      health: 1,
      belonging: 1,
      rest: 1,
    });
  });
});
