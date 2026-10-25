import { describe, expect, it, vi } from "vitest";
import { CONTENT_VERSION } from "../../src/content/version";
import { adultPercentile, dailyIncome } from "../../src/engine/money";
import { SEED_PATTERN } from "../../src/engine/seed";
import {
  DEFAULT_SETTINGS,
  type LifeState,
  type Person,
  type Relationship,
  type YearRecord,
} from "../../src/engine/types";
import {
  browserSeed,
  closenessBand,
  createGameStore,
  EPITAPH_MAX_LENGTH,
  countryFacts,
  lifeOverview,
  lifeRings,
  lifeStrip,
  planToSend,
  statBand,
} from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { adultAt, makePerson, moneyAt } from "../fixtures/person";
import { deadlyCountry, fakePersistence, finishedLife } from "./fakes";

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

describe("game store: saving, death and the archive (M6)", () => {
  const clock = () => {
    let n = 0;
    return () => new Date(Date.UTC(2026, 9, 25, 10, 0, n++)).toISOString();
  };
  const withFake = (world = testWorld(), fake = fakePersistence()) => ({
    fake,
    store: createGameStore(seeds(), world, fake.persistence, clock()),
  });
  const playOn = (store: ReturnType<typeof createGameStore>, years: number) => {
    for (let i = 0; i < years && store.getSnapshot().life?.person.alive; i++) {
      const { card } = store.getSnapshot();
      if (card) store.choose(card.choices.find((c) => !c.lockedReason)!.id);
      else store.continueYear();
    }
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const lifeToTheEnd = async (store: ReturnType<typeof createGameStore>) => {
    await store.begin();
    store.startLife();
    playOn(store, 300);
  };

  describe("autosave (SAVE-001)", () => {
    it("saves the drawn birth, then the life after every resolved turn, keeping when it was first saved", async () => {
      const { store, fake } = withFake();
      store.setSettings({ pace: "every-year" });
      await store.begin();
      expect(fake.saved).toHaveLength(1);
      expect(fake.saved[0]).toMatchObject({
        seed: "seed-0",
        countryIso3: "AAA",
        years: 0,
        dataVersion: "test",
        contentVersion: CONTENT_VERSION,
      });
      store.startLife();
      store.continueYear();
      store.continueYear();
      const last = fake.saved.at(-1)!;
      expect(last.years).toBe(store.getSnapshot().life!.history.length);
      expect(last.years).toBeGreaterThanOrEqual(1);
      expect(last.snapshot).toEqual(store.getSnapshot().life);
      expect(new Set(fake.saved.map((s) => s.createdAt)).size).toBe(1);
      expect(last.updatedAt > last.createdAt).toBe(true);
    });

    it("saves after a decision is answered and after a setting is changed", async () => {
      const { store, fake } = withFake();
      await store.begin();
      store.startLife();
      while (store.getSnapshot().life?.person.alive && !store.getSnapshot().card) store.continueYear();
      const card = store.getSnapshot().card;
      expect(card).not.toBeNull();
      expect(fake.saved.at(-1)!.waiting).toBe(true);
      const before = fake.saved.length;
      store.choose(card!.choices.find((c) => !c.lockedReason)!.id);
      expect(fake.saved.length).toBe(before + 1);
      expect(fake.saved.at(-1)!.waiting).toBe(store.getSnapshot().card !== null);
      store.setSettings({ softening: true });
      expect(fake.saved.at(-1)!.settingsLog.at(-1)!.changes).toEqual({ softening: true });
    });

    it("starts a new createdAt for each life", async () => {
      const { store, fake } = withFake();
      await store.begin();
      const first = fake.saved.at(-1)!;
      await store.begin();
      const second = fake.saved.at(-1)!;
      expect(second.seed).toBe("seed-1");
      expect(second.createdAt > first.createdAt).toBe(true);
    });

    it("says so when the browser refuses the save, and stops saying so after a save that works", async () => {
      const { store, fake } = withFake();
      fake.refuseCurrent = true;
      await store.begin();
      expect(store.getSnapshot().problem).toBe("current");
      store.startLife();
      store.continueYear();
      expect(store.getSnapshot().problem).toBe("current");
      fake.refuseCurrent = false;
      store.continueYear();
      expect(store.getSnapshot().problem).toBeNull();
    });
  });

  describe("death (DEATH-001, SUM-001)", () => {
    it("ends on the summary: summarises the life, archives it and clears the life in progress", async () => {
      const { store, fake } = withFake(testWorld(deadlyCountry()));
      await store.begin();
      store.startLife();
      store.continueYear();
      // The life in progress is only cleared once the archive has it.
      expect(fake.current.status).toBe("found");
      await settle();
      const snapshot = store.getSnapshot();
      expect(snapshot.screen).toBe("summary");
      expect(snapshot.card).toBeNull();
      expect(snapshot.plan).toBeNull();
      expect(snapshot.summary).toMatchObject({ archived: false });
      const { summary, lastYear } = snapshot.summary!;
      expect(summary.seed).toBe("seed-0");
      expect(summary.death.age).toBe(0);
      expect(summary.name).toBe(snapshot.life!.person.name);
      expect(lastYear).toEqual(snapshot.life!.history.at(-1)!.events);
      expect(fake.puts).toHaveLength(1);
      expect(fake.puts[0]).toMatchObject({ id: "seed-0", summary, finishedAt: expect.any(String) });
      expect(fake.puts[0]!.save.snapshot.death).toBeDefined();
      expect(fake.cleared).toBe(1);
      expect(fake.current).toEqual({ status: "none" });
      expect(snapshot.problem).toBeNull();
    });

    it("goes to the summary after a decision that ends the life, too", async () => {
      const { store, fake } = withFake();
      await lifeToTheEnd(store);
      expect(store.getSnapshot().screen).toBe("summary");
      expect(store.getSnapshot().life?.person.alive).toBe(false);
      expect(fake.puts).toHaveLength(1);
      // Nothing more is written for a life that is over.
      const saves = fake.saved.length;
      store.setSettings({ softening: true });
      store.continueYear();
      expect(fake.saved).toHaveLength(saves);
    });

    it("says so when the archive could not keep the life, and still shows the summary", async () => {
      const { store, fake } = withFake(testWorld(deadlyCountry()));
      fake.failArchive = true;
      await store.begin();
      store.startLife();
      store.continueYear();
      await settle();
      expect(store.getSnapshot().screen).toBe("summary");
      expect(store.getSnapshot().problem).toBe("archive");
      // The life in progress is kept, so nothing is lost and it can be finished again later.
      expect(fake.cleared).toBe(0);
      expect(fake.current.status).toBe("found");
    });

    it("does not clear a newer life's save when the archive finishes late", async () => {
      const { store, fake } = withFake(testWorld(deadlyCountry()));
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const put = fake.persistence.archive.put;
      fake.persistence.archive.put = (life) => gate.then(() => put(life));
      await store.begin();
      store.startLife();
      store.continueYear();
      await store.begin();
      expect(fake.saved.at(-1)!.seed).toBe("seed-1");
      release();
      await settle();
      expect(fake.lives.has("seed-0")).toBe(true);
      expect(fake.current).toMatchObject({ status: "found", raw: { seed: "seed-1" } });
    });

    it("does not let a late archive write for an earlier life clear the note about this one", async () => {
      const { store, fake } = withFake(testWorld(deadlyCountry()));
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const put = fake.persistence.archive.put;
      let calls = 0;
      fake.persistence.archive.put = (life) =>
        calls++ === 0 ? gate.then(() => put(life)) : Promise.reject(new Error("full"));
      await store.begin();
      store.startLife();
      store.continueYear();
      await store.begin();
      store.startLife();
      store.continueYear();
      await settle();
      expect(store.getSnapshot()).toMatchObject({ screen: "summary", problem: "archive" });
      release();
      await settle();
      expect(fake.lives.has("seed-0")).toBe(true);
      expect(store.getSnapshot().problem).toBe("archive");
    });

    it("begins another life from the summary, and goes back to the start screen", async () => {
      const { store } = withFake(testWorld(deadlyCountry()));
      await store.begin();
      store.startLife();
      store.continueYear();
      await store.begin();
      expect(store.getSnapshot()).toMatchObject({ screen: "birth", summary: null });
      expect(store.getSnapshot().life?.seed).toBe("seed-1");
      await store.begin();
      store.startLife();
      store.continueYear();
      store.backToStart();
      expect(store.getSnapshot()).toMatchObject({ screen: "start", summary: null, life: null });
    });
  });

  describe("resume (SAVE-002, SAVE-004, SAVE-005)", () => {
    const savedMidLife = async (years = 3, world = testWorld()) => {
      const first = withFake(world);
      first.store.setSettings({ pace: "every-year" });
      await first.store.begin();
      first.store.startLife();
      playOn(first.store, years);
      return first;
    };

    it("offers nothing when there is no saved life", () => {
      const { store } = withFake();
      store.init();
      expect(store.getSnapshot().resume).toBeNull();
    });

    it("offers the life in progress with its name and age", async () => {
      const { fake, store } = await savedMidLife();
      const life = store.getSnapshot().life!;
      const { store: reopened } = withFake(testWorld(), fake);
      reopened.init();
      expect(reopened.getSnapshot().resume).toEqual({
        kind: "offer",
        seed: "seed-0",
        countryIso3: "AAA",
        name: life.person.name,
        age: life.person.age,
      });
      expect(reopened.getSnapshot().screen).toBe("start");
    });

    it("names the place of the saved life once the index is read", async () => {
      const { fake } = await savedMidLife(1);
      const { store } = withFake(testWorld(), fake);
      store.init();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(store.getSnapshot().resume).toMatchObject({ kind: "offer", country: { iso2: "AA", name: "Testland" } });
    });

    it("does not stop for storage that throws: a save the browser refused, a saved life that cannot be read", async () => {
      const { store, fake } = withFake();
      fake.persistence.saveCurrent = () => {
        throw new Error("SecurityError");
      };
      fake.persistence.clearCurrent = () => {
        throw new Error("SecurityError");
      };
      await store.begin();
      expect(store.getSnapshot().problem).toBe("current");
      store.discardSaved();
      const blocked = withFake();
      blocked.fake.persistence.loadCurrent = () => {
        throw new Error("SecurityError");
      };
      blocked.store.init();
      expect(blocked.store.getSnapshot().resume).toEqual({ kind: "problem", reason: "unreadable" });
    });

    it("offers a life whose snapshot cannot be trusted without its name and age", async () => {
      const { fake } = await savedMidLife();
      const raw = fake.current.status === "found" ? (fake.current.raw as Record<string, unknown>) : {};
      fake.current = { status: "found", raw: { ...raw, snapshot: { broken: true } } };
      const { store } = withFake(testWorld(), fake);
      store.init();
      expect(store.getSnapshot().resume).toEqual({ kind: "offer", seed: "seed-0", countryIso3: "AAA" });
    });

    it("says why a saved life cannot be opened and never throws", async () => {
      const { fake } = await savedMidLife(1);
      const raw = fake.current.status === "found" ? (fake.current.raw as Record<string, unknown>) : {};
      const cases: [Parameters<typeof fakePersistence>[0], string][] = [
        [{ status: "found", raw: { ...raw, schemaVersion: 99 } }, "unsupported"],
        [{ status: "found", raw: { nothing: "here" } }, "damaged"],
        [{ status: "found", raw: null }, "damaged"],
        [{ status: "unreadable" }, "unreadable"],
      ];
      for (const [current, reason] of cases) {
        const { store } = withFake(testWorld(), fakePersistence(current));
        expect(() => store.init()).not.toThrow();
        expect(store.getSnapshot().resume).toEqual({ kind: "problem", reason });
      }
    });

    it("brings the life back from its snapshot at the same age, with the same decision waiting, and saves nothing itself", async () => {
      const { fake, store } = await savedMidLife(40);
      const before = store.getSnapshot();
      const saves = fake.saved.length;
      const { store: reopened } = withFake(testWorld(), fake);
      reopened.init();
      await reopened.resumeLife();
      const after = reopened.getSnapshot();
      expect(after.screen).toBe("life");
      expect(after.life).toEqual(before.life);
      expect(after.country?.iso3).toBe("AAA");
      expect(after.sources).not.toBeNull();
      expect(after.card?.eventId).toBe(before.card?.eventId);
      expect(after.plan).toEqual(before.plan);
      expect(after.settings).toEqual(before.life!.settings);
      expect(after.restored).toBeNull();
      expect(after.status).toBe("idle");
      expect(fake.saved).toHaveLength(saves);
      // Play goes on from there and is saved again.
      playOn(reopened, 1);
      expect(fake.saved.length).toBeGreaterThan(saves);
      expect(fake.saved.at(-1)!.seed).toBe("seed-0");
    });

    it("resumes at the birth screen when the life has no years yet", async () => {
      const { fake } = withFake();
      const first = createGameStore(seeds(), testWorld(), fake.persistence, clock());
      await first.begin();
      const { store } = withFake(testWorld(), fake);
      store.init();
      await store.resumeLife();
      expect(store.getSnapshot().screen).toBe("birth");
      expect(store.getSnapshot().life?.history).toHaveLength(0);
    });

    it("rebuilds the life from its seed when the snapshot is damaged, and says so", async () => {
      const { fake, store } = await savedMidLife(5);
      const lived = store.getSnapshot().life!;
      const raw = fake.current.status === "found" ? (fake.current.raw as Record<string, unknown>) : {};
      fake.current = { status: "found", raw: { ...raw, snapshot: { broken: true } } };
      const { store: reopened } = withFake(testWorld(), fake);
      reopened.init();
      await reopened.resumeLife();
      expect(reopened.getSnapshot().restored).toBe("replayed");
      expect(reopened.getSnapshot().life?.person.age).toBe(lived.person.age);
      expect(reopened.getSnapshot().life?.history).toEqual(lived.history);
    });

    it("says the game was updated when the data or content of the save is not the current one (RNG-004)", async () => {
      const { fake } = await savedMidLife(3);
      const world = testWorld();
      const loadIndex = async () => ({ ...(await world.loadIndex()), dataVersion: "newer" });
      const { store } = withFake({ ...world, loadIndex }, fake);
      store.init();
      await store.resumeLife();
      expect(store.getSnapshot().screen).toBe("life");
      expect(store.getSnapshot().restored).toBe("inexact");
    });

    it("says both when the snapshot was unusable and the save is from another version", async () => {
      const { fake } = await savedMidLife(3);
      const raw = fake.current.status === "found" ? (fake.current.raw as Record<string, unknown>) : {};
      fake.current = { status: "found", raw: { ...raw, snapshot: { broken: true } } };
      const world = testWorld();
      const loadIndex = async () => ({ ...(await world.loadIndex()), dataVersion: "newer" });
      const { store } = withFake({ ...world, loadIndex }, fake);
      store.init();
      await store.resumeLife();
      expect(store.getSnapshot().restored).toBe("both");
    });

    it("clears the note after the next turn", async () => {
      const { fake } = await savedMidLife(3);
      const world = testWorld();
      const loadIndex = async () => ({ ...(await world.loadIndex()), dataVersion: "newer" });
      const { store } = withFake({ ...world, loadIndex }, fake);
      store.init();
      await store.resumeLife();
      playOn(store, 1);
      expect(store.getSnapshot().restored).toBeNull();
    });

    it("turns a life that cannot be rebuilt into a damaged-save message and keeps the player on the start screen", async () => {
      const { fake } = await savedMidLife(3);
      const raw = fake.current.status === "found" ? (fake.current.raw as Record<string, unknown>) : {};
      fake.current = {
        status: "found",
        raw: { ...raw, snapshot: null, decisions: [{ year: 99, eventId: "x", choiceId: "y" }], waiting: true },
      };
      const { store } = withFake(testWorld(), fake);
      store.init();
      await store.resumeLife();
      expect(store.getSnapshot()).toMatchObject({
        screen: "start",
        resume: { kind: "problem", reason: "damaged" },
        life: null,
      });
    });

    it("keeps the offer and shows the load error when the world cannot be loaded", async () => {
      const { fake } = await savedMidLife(2);
      const world = testWorld();
      const { store } = withFake({ ...world, loadCountry: () => Promise.reject(new Error("offline")) }, fake);
      store.init();
      const offer = store.getSnapshot().resume;
      await store.resumeLife();
      expect(store.getSnapshot()).toMatchObject({ screen: "start", status: "error", resume: offer });
    });

    it("ignores a resume that finishes after the player went back", async () => {
      const { fake } = await savedMidLife(2);
      const world = testWorld();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const { store } = withFake({ ...world, loadIndex: () => gate.then(world.loadIndex) }, fake);
      store.init();
      const done = store.resumeLife();
      store.backToStart();
      release();
      await done;
      expect(store.getSnapshot().screen).toBe("start");
    });

    it("discards the saved life", async () => {
      const { fake } = await savedMidLife(2);
      const { store } = withFake(testWorld(), fake);
      store.init();
      store.discardSaved();
      expect(store.getSnapshot().resume).toBeNull();
      expect(fake.current).toEqual({ status: "none" });
    });

    it("offers the life again when the player goes back to the start screen during it", async () => {
      const { store } = await savedMidLife(2);
      expect(store.getSnapshot().resume).toBeNull();
      store.backToStart();
      expect(store.getSnapshot().resume).toMatchObject({ kind: "offer", seed: "seed-0" });
    });

    it("does not offer a life that has ended", async () => {
      const { store } = withFake();
      await lifeToTheEnd(store);
      await settle();
      store.backToStart();
      expect(store.getSnapshot().resume).toBeNull();
    });
  });

  describe("epitaph (DEATH-004)", () => {
    const endedStore = async () => {
      const { store, fake } = withFake(testWorld(deadlyCountry()));
      await store.begin();
      store.startLife();
      store.continueYear();
      await Promise.resolve();
      return { store, fake };
    };

    it("is kept with the life: tidied, shown in the summary and written to the archive again", async () => {
      const { store, fake } = await endedStore();
      store.writeEpitaph("  Kept   bees.  ");
      await Promise.resolve();
      expect(store.getSnapshot().summary!.summary.epitaph).toBe("Kept bees.");
      const stored = fake.puts.at(-1)!;
      expect(stored.id).toBe("seed-0");
      expect(stored.summary.epitaph).toBe("Kept bees.");
      expect(stored.save.epitaph).toBe("Kept bees.");
      expect(stored.save.snapshot.epitaph).toBe("Kept bees.");
      // The save keeps its own versions and the time the life was first saved.
      const first = fake.puts[0]!;
      expect(stored.save.createdAt).toBe(first.save.createdAt);
      expect(stored.save.dataVersion).toBe(first.save.dataVersion);
      expect(stored.save.updatedAt > first.save.updatedAt).toBe(true);
      expect(stored.finishedAt).toBe(first.finishedAt);
    });

    it("is cut to the longest allowed and removed when emptied", async () => {
      const { store, fake } = await endedStore();
      store.writeEpitaph("x".repeat(EPITAPH_MAX_LENGTH + 40));
      expect(store.getSnapshot().summary!.summary.epitaph).toHaveLength(EPITAPH_MAX_LENGTH);
      store.writeEpitaph("   ");
      expect(store.getSnapshot().summary!.summary).not.toHaveProperty("epitaph");
      expect(fake.puts.at(-1)!.save).not.toHaveProperty("epitaph");
    });

    it("can be written to a life opened from the archive, with that life's own versions", async () => {
      const country = makeCountry({ region: "Western Africa" });
      const { past } = finishedLife("old-1", country);
      const old = { ...past, save: { ...past.save, dataVersion: "older", contentVersion: "older-content" } };
      const fake = fakePersistence({ status: "none" }, [old]);
      const store = createGameStore(seeds(), testWorld(country), fake.persistence, clock());
      await store.openPastLife("old-1");
      expect(store.getSnapshot()).toMatchObject({ screen: "summary", summary: { archived: true } });
      store.writeEpitaph("Walked far");
      await Promise.resolve();
      expect(store.getSnapshot().summary!.summary.epitaph).toBe("Walked far");
      expect(fake.puts).toHaveLength(1);
      expect(fake.puts[0]!.save).toMatchObject({
        dataVersion: "older",
        contentVersion: "older-content",
        epitaph: "Walked far",
        createdAt: old.save.createdAt,
      });
      expect(fake.lives.get("old-1")!.summary.epitaph).toBe("Walked far");
    });

    it("does nothing when no summary is on screen", () => {
      const { store, fake } = withFake();
      store.writeEpitaph("Nobody");
      expect(fake.puts).toHaveLength(0);
    });

    it("says so when the archive could not keep it", async () => {
      const { store, fake } = await endedStore();
      fake.failArchive = true;
      store.writeEpitaph("Not kept");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(store.getSnapshot().problem).toBe("archive");
      expect(store.getSnapshot().summary!.summary.epitaph).toBe("Not kept");
    });
  });

  describe("past lives (SAVE-003, SAVE-007)", () => {
    const country = makeCountry({ region: "Western Africa" });
    const lives = () => [
      finishedLife("past-a", country, undefined, "2026-10-20T10:00:00.000Z").past,
      finishedLife("past-b", country, "Walked far", "2026-10-22T10:00:00.000Z").past,
    ];
    const withLives = () => {
      const fake = fakePersistence({ status: "none" }, lives());
      return { fake, store: createGameStore(seeds(), testWorld(country), fake.persistence, clock()) };
    };

    it("lists the lives, newest first, and says nothing until they are loaded", async () => {
      const { store } = withLives();
      expect(store.getSnapshot().pastLives).toBeNull();
      const done = store.openPast();
      expect(store.getSnapshot()).toMatchObject({ screen: "past", pastLives: null });
      await done;
      expect(store.getSnapshot().pastLives!.map((l) => l.id)).toEqual(["past-b", "past-a"]);
    });

    it("shows an empty list and says so when the archive cannot be read", async () => {
      const { store, fake } = withLives();
      fake.failArchive = true;
      await store.openPast();
      expect(store.getSnapshot()).toMatchObject({ screen: "past", pastLives: [], problem: "archive" });
    });

    it("opens a life as an archived summary with the sources for its notes", async () => {
      const { store } = withLives();
      await store.openPast();
      await store.openPastLife("past-b");
      const snapshot = store.getSnapshot();
      expect(snapshot.screen).toBe("summary");
      expect(snapshot.summary).toMatchObject({ archived: true, summary: { seed: "past-b", epitaph: "Walked far" } });
      expect(snapshot.summary!.lastYear).toEqual(lives()[1]!.save.snapshot.history.at(-1)!.events);
      expect(snapshot.sources).not.toBeNull();
    });

    it("stays on the list when the life is gone", async () => {
      const { store } = withLives();
      await store.openPast();
      await store.openPastLife("nobody");
      expect(store.getSnapshot().screen).toBe("past");
      expect(store.getSnapshot().problem).toBe("archive");
    });

    it("deletes one life and refreshes the list", async () => {
      const { store, fake } = withLives();
      await store.openPast();
      expect(await store.deletePastLife("past-b")).toBe(true);
      expect(store.getSnapshot().pastLives!.map((l) => l.id)).toEqual(["past-a"]);
      expect(fake.lives.has("past-b")).toBe(false);
    });

    it("says a delete failed, and keeps the life, when the archive would not remove it", async () => {
      const { store, fake } = withLives();
      fake.persistence.archive.remove = () => Promise.reject(new Error("blocked"));
      await store.openPast();
      expect(await store.deletePastLife("past-b")).toBe(false);
      expect(store.getSnapshot().problem).toBe("archive");
      expect(store.getSnapshot().pastLives).toHaveLength(2);
    });

    it("ignores a life that opens after the player went back", async () => {
      const { store, fake } = withLives();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const get = fake.persistence.archive.get;
      fake.persistence.archive.get = (id) => gate.then(() => get(id));
      await store.openPast();
      const done = store.openPastLife("past-a");
      store.backToStart();
      release();
      await done;
      expect(store.getSnapshot().screen).toBe("start");
    });

    it("deletes all data: storage emptied, the store back at its start with default settings", async () => {
      const { store, fake } = withLives();
      store.setSettings({ softening: true, pace: "every-year" });
      store.toggleUsPrices();
      await store.begin();
      store.startLife();
      await store.openPast();
      expect(await store.deleteAllData()).toBe(true);
      expect(fake.deleted).toBe(true);
      expect(fake.lives.size).toBe(0);
      expect(store.getSnapshot()).toMatchObject({
        screen: "start",
        resume: null,
        pastLives: [],
        summary: null,
        life: null,
        showUsPrices: false,
        settings: { softening: false, pace: "quiet-years" },
      });
      store.backToStart();
      expect(store.getSnapshot().resume).toBeNull();
    });

    it("says that everything was deleted, until the player goes anywhere else", async () => {
      const { store } = withLives();
      expect(store.getSnapshot().deleted).toBe(false);
      await store.openPast();
      await store.deleteAllData();
      expect(store.getSnapshot().deleted).toBe(true);
      store.openSources();
      expect(store.getSnapshot().deleted).toBe(false);
    });

    it("leaves the store as it was when the data could not be deleted", async () => {
      const { store, fake } = withLives();
      fake.persistence.deleteAll = () => Promise.reject(new Error("blocked"));
      await store.openPast();
      expect(await store.deleteAllData()).toBe(false);
      expect(store.getSnapshot()).toMatchObject({ screen: "past", problem: "archive" });
      expect(store.getSnapshot().pastLives).toHaveLength(2);
    });
  });
});

// The life screen's header strip, the stat words and the country tab (UI-004, UI-010).
describe("the life strip", () => {
  const person = makePerson({ age: 16 });
  const year = (age: number, events: YearRecord["events"] = []): YearRecord => ({
    age,
    stage: "adolescence",
    stageChanged: false,
    stats: person.stats,
    events,
  });
  const told = { id: "e", textKey: "event.midlife.looking_back", effects: [] };
  const lifeWith = (age: number, history: YearRecord[]): LifeState => ({
    seed: "t",
    person: { ...person, age },
    history,
    settings: DEFAULT_SETTINGS,
    decisions: [],
  });

  it("runs to about 80, and to 100 once the person is past 75", () => {
    expect(lifeStrip(lifeWith(16, [])).end).toBe(80);
    expect(lifeStrip(lifeWith(75, [])).end).toBe(80);
    expect(lifeStrip(lifeWith(76, [])).end).toBe(100);
  });

  it("marks the ages of the key moments, and only years that had something to tell", () => {
    const history = [year(5), year(6, [told]), year(7), year(8, [told])];
    const strip = lifeStrip(lifeWith(8, history));
    expect(strip.age).toBe(8);
    // keyMoments names the age lived in the year, which is one less than the age reached at its end.
    expect(strip.moments).toEqual([5, 7]);
  });

  it("has no marks for a life with nothing told yet", () => {
    expect(lifeStrip(lifeWith(0, [])).moments).toEqual([]);
  });

  it("gives one ring a year", () => {
    expect(lifeRings([year(1), year(2, [told])])).toHaveLength(2);
  });
});

describe("stat bands (UI-004)", () => {
  it("names a stat's level in five words that a screen reader hears with the number", () => {
    expect(statBand(0)).toBe("very-low");
    expect(statBand(19.6)).toBe("very-low");
    expect(statBand(20)).toBe("low");
    expect(statBand(45)).toBe("fair");
    expect(statBand(60)).toBe("good");
    expect(statBand(80)).toBe("very-good");
    expect(statBand(100)).toBe("very-good");
  });
});

describe("country facts (UI-004)", () => {
  const country = makeCountry();

  it("takes the life expectancy, school completion and middle income from the country's own data, with source and year", () => {
    const facts = countryFacts("female", country);
    expect(facts.lifeExpectancy).toMatchObject({ source: "test", year: 2023 });
    expect(facts.lifeExpectancy!.years).toBeGreaterThan(40);
    expect(facts.upperSecondary).toEqual({ share: 0.5, source: "test", year: 2023 });
    expect(facts.middleIncome).toEqual({ daily: dailyIncome(country, 50), source: "test", year: 2023 });
  });

  it("uses the person's sex for the life expectancy and school completion", () => {
    const base = makeCountry();
    const mixed = makeCountry({
      education: {
        ...base.education,
        upperSecondaryCompletion: { value: { female: 0.3, male: 0.6 }, source: "test", year: 2020 },
      },
    });
    expect(countryFacts("female", mixed).upperSecondary?.share).toBe(0.3);
    expect(countryFacts("male", mixed).upperSecondary?.share).toBe(0.6);
  });

  it("leaves out a value that was filled from a regional average, because it is not a fact about this country", () => {
    const base = makeCountry();
    const estimated = makeCountry({
      education: {
        ...base.education,
        upperSecondaryCompletion: { ...base.education.upperSecondaryCompletion, estimated: true },
      },
      money: { ...base.money, percentiles: { ...base.money.percentiles, estimated: true } },
      demography: { ...base.demography, lifeTable: { ...base.demography.lifeTable, estimated: true } },
    });
    expect(countryFacts("male", estimated)).toEqual({});
  });
});
