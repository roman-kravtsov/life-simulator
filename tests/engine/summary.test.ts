import { describe, expect, it } from "vitest";
import { en } from "../../src/content/strings/en";
import { advanceAuto, newLife, withEpitaph, EPITAPH_MAX_LENGTH } from "../../src/engine/life";
import { MIN_THICKNESS, RING_THEMES, ringThickness, yearLived, yearTheme } from "../../src/engine/rings";
import {
  DOMINANT_SHARE,
  MOMENTS_MAX,
  MOMENTS_MIN,
  MOMENT_THRESHOLD,
  keyMoments,
  shaping,
  summarize,
  yearScore,
} from "../../src/engine/summary";
import type { EventRecord, LifeState, YearRecord } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const country = makeCountry({ region: "Western Africa" });

function lived(seed: string): LifeState {
  let life = newLife({ seed, country, settings: { pace: "every-year" } });
  while (life.person.alive) life = advanceAuto(life, country);
  return life;
}

const event = (overrides: Partial<EventRecord> = {}): EventRecord => ({
  id: "test.event",
  textKey: "event.test.event",
  effects: [],
  ...overrides,
});

const stats = { health: 70, happiness: 60, belonging: 60, skills: 40 };
const year = (age: number, events: EventRecord[] = [], extra: Partial<YearRecord> = {}): YearRecord => ({
  age: age + 1,
  stage: "adulthood",
  stageChanged: false,
  stats,
  events,
  ...extra,
});

describe("SUM-002: the rings", () => {
  it("makes a ring thicker the happier the year, never thinner than the minimum", () => {
    expect(ringThickness(0)).toBe(MIN_THICKNESS);
    expect(ringThickness(100)).toBe(1);
    expect(ringThickness(50)).toBeGreaterThan(ringThickness(20));
    expect(ringThickness(-10)).toBe(MIN_THICKNESS);
    expect(ringThickness(140)).toBe(1);
  });

  describe("the theme of a year", () => {
    const person = makePerson({ age: 30, stage: "adulthood" });
    it("is loss for a death in the family, before anything else", () => {
      const grief = event({
        helpTopic: "grief",
        effects: [{ effect: { stat: "happiness", add: -5 }, cause: "chance" }],
      });
      const illness = event({
        effects: [{ effect: { condition: "add", id: "malaria", severity: 1 }, cause: "chance" }],
      });
      expect(yearTheme(person, [illness, grief])).toBe("loss");
    });
    it("is illness when a condition begins or worsens, or one is serious", () => {
      const begins = event({
        effects: [{ effect: { condition: "add", id: "malaria", severity: 1 }, cause: "chance" }],
      });
      expect(yearTheme(person, [begins])).toBe("illness");
      const serious = makePerson({ conditions: [{ id: "malaria", severity: 2, since: 20 }] });
      expect(yearTheme(serious, [])).toBe("illness");
      const mild = makePerson({ conditions: [{ id: "malaria", severity: 1, since: 20 }] });
      expect(yearTheme(mild, [])).toBe("plain");
    });
    it("is love when a partner, spouse or child comes into the life", () => {
      const relative = {
        id: "c1",
        kind: "child",
        name: "Ada",
        sex: "female",
        age: 0,
        alive: true,
        closeness: 80,
      } as const;
      const born = event({ effects: [{ effect: { relationship: "add", relative }, cause: "chance" }] });
      expect(yearTheme(person, [born])).toBe("love");
      const sibling = { ...relative, kind: "sibling" } as const;
      const a = event({ effects: [{ effect: { relationship: "add", relative: sibling }, cause: "chance" }] });
      expect(yearTheme(person, [a])).toBe("plain");
      const wed = event({ effects: [{ effect: { become: "spouse", id: "p1" }, cause: "choice" }] });
      expect(yearTheme(person, [wed])).toBe("love");
    });
    it("is move when the person moves between countryside and city", () => {
      const moved = event({ effects: [{ effect: { move: "urban" }, cause: "choice" }] });
      expect(yearTheme(person, [moved])).toBe("move");
    });
    it("is study in school, work in a job, and plain otherwise", () => {
      expect(yearTheme(makePerson({ education: { level: "primary", inSchool: true, years: 4 } }), [])).toBe("study");
      const left = event({ effects: [{ effect: { school: "leave" }, cause: "choice" }] });
      expect(yearTheme(person, [left])).toBe("study");
      expect(yearTheme(makePerson({ work: { status: "employed", yearsWorked: 3, attachment: 0.5 } }), [])).toBe("work");
      expect(yearTheme(makePerson({ work: { status: "informal", yearsWorked: 3, attachment: 0.5 } }), [])).toBe("work");
      expect(yearTheme(makePerson({ work: { status: "retired", yearsWorked: 40, attachment: 0.5 } }), [])).toBe(
        "plain",
      );
    });
  });

  it("gives every finished life one ring a year, each with a theme and a thickness", () => {
    for (let i = 0; i < 12; i++) {
      const life = lived(`rings-${i}`);
      const { rings } = summarize(life, country);
      expect(rings).toHaveLength(life.history.length);
      expect(rings.map((r) => r.age)).toEqual(life.history.map(yearLived));
      expect(rings.at(-1)!.age).toBe(life.death!.age);
      for (const ring of rings) {
        expect(RING_THEMES).toContain(ring.theme);
        expect(ring.thickness).toBeGreaterThanOrEqual(MIN_THICKNESS);
        expect(ring.thickness).toBeLessThanOrEqual(1);
      }
    }
  });

  it("uses every theme across a handful of lives, and plain does not take over", () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 25; i++) {
      for (const ring of summarize(lived(`themes-${i}`), country).rings)
        seen.set(ring.theme, (seen.get(ring.theme) ?? 0) + 1);
    }
    for (const theme of ["study", "work", "love", "loss", "illness", "plain"])
      expect(seen.get(theme), theme).toBeGreaterThan(0);
    const total = [...seen.values()].reduce((a, b) => a + b, 0);
    expect(seen.get("plain")! / total).toBeLessThan(0.6);
  });

  it("numbers the rings that hold a key moment", () => {
    const { rings, moments } = summarize(lived("moments-ring"), country);
    const marked = rings.filter((r) => r.moment !== undefined);
    expect(marked.map((r) => r.moment)).toEqual(moments.map((_, i) => i + 1));
    expect(marked.map((r) => r.age)).toEqual(moments.map((m) => m.age));
  });
});

describe("SUM-003: key moments", () => {
  const big = (id: string): EventRecord =>
    event({
      id,
      textKey: `event.${id}`,
      sensitivity: "severe",
      decision: { choiceId: "a", choiceTextKey: "c", outcomeTextKey: "o" },
    });
  const small = (id: string): EventRecord => event({ id, textKey: `event.${id}` });

  it("scores a year by what happened in it, and ignores quiet texture", () => {
    expect(yearScore(year(10, []))).toBe(0);
    expect(yearScore(year(10, [event({ quiet: true })]))).toBe(0);
    expect(yearScore(year(10, [small("a")]))).toBeLessThan(MOMENT_THRESHOLD);
    expect(yearScore(year(10, [big("a")]))).toBeGreaterThanOrEqual(MOMENT_THRESHOLD);
    expect(yearScore(year(10, [small("a")], { stageChanged: true }))).toBeGreaterThan(
      yearScore(year(10, [small("a")])),
    );
  });

  it("takes the years that score above the threshold, at most twelve, and puts them in order of age", () => {
    const history = Array.from({ length: 40 }, (_, age) =>
      year(age, [age % 3 === 0 ? big(`e${age}`) : small(`e${age}`)]),
    );
    history.push(year(40, [], { died: true, age: 40 }));
    const moments = keyMoments(history);
    expect(moments).toHaveLength(MOMENTS_MAX);
    expect(moments.map((m) => m.age)).toEqual([...moments.map((m) => m.age)].sort((a, b) => a - b));
    for (const m of moments) expect(m.age % 3).toBe(0);
  });

  it("takes only the strong years when there are between five and twelve of them", () => {
    const history = Array.from({ length: 30 }, (_, age) => year(age, [age < 7 ? big(`e${age}`) : small(`e${age}`)]));
    expect(keyMoments(history).map((m) => m.age)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("fills up to five from the next best years when fewer are strong, and never takes a year with nothing told", () => {
    const history = Array.from({ length: 30 }, (_, age) =>
      year(age, age === 4 ? [big("e4")] : age % 2 ? [small(`e${age}`)] : []),
    );
    const moments = keyMoments(history);
    expect(moments).toHaveLength(MOMENTS_MIN);
    expect(moments.map((m) => m.age)).toContain(4);
    for (const m of moments) expect(m.age === 4 || m.age % 2 === 1).toBe(true);
  });

  it("shows every year with something to tell in a short life, and leaves out the year of death", () => {
    const history = [year(0, [small("a")]), year(1, [big("b")]), year(2, [small("c")], { died: true, age: 2 })];
    expect(keyMoments(history).map((m) => m.age)).toEqual([0, 1]);
    expect(keyMoments([year(0, [], { died: true, age: 0 })])).toEqual([]);
  });

  it("picks the event that weighs most as the headline, and carries its text and decision", () => {
    const decided = big("big");
    const moments = keyMoments([year(10, [small("a"), decided, small("c")])]);
    expect(moments[0]).toMatchObject({ age: 10, eventId: "big", textKey: "event.big", decision: decided.decision });
  });

  it("gives every finished life between 5 and 12 moments when it lasted long enough, each with a text that exists", () => {
    for (let i = 0; i < 30; i++) {
      const life = lived(`key-${i}`);
      const { moments } = summarize(life, country);
      const withEvents = life.history.filter((r) => !r.died && r.events.some((e) => !e.quiet)).length;
      expect(moments.length).toBeLessThanOrEqual(MOMENTS_MAX);
      expect(moments.length).toBe(Math.min(withEvents, Math.max(MOMENTS_MIN, moments.length)));
      if (withEvents >= MOMENTS_MIN) expect(moments.length).toBeGreaterThanOrEqual(MOMENTS_MIN);
      for (const m of moments) expect(en, m.textKey).toHaveProperty([m.textKey]);
    }
  });
});

describe("SUM-004: chance, choice and circumstance", () => {
  const all = (v: number) => ({ health: v, happiness: v, belonging: v, skills: v });
  /** A year's drift: where the norm lay from the neutral person's, by source, and the random swing. */
  const drift = (circumstance: number, choice: number, chance: number, noise = 0) => ({
    norm: { circumstance: all(circumstance), choice: all(choice), chance: all(chance) },
    noise: all(noise),
  });
  const stat = (add: number, cause: "circumstance" | "choice" | "chance", id: "health" | "belonging" = "health") =>
    event({ effects: [{ effect: { stat: id, add }, cause, delta: add }] });

  it("compares how large each source's share of the level was over the life, in shares that sum to one", () => {
    // Skills keep what they had and take up the whole year's change, so one year is easy to read off.
    const history = [year(0, [stat(2, "chance")], { drift: drift(4, 4, 0) })];
    const { stats } = shaping(history);
    // Health takes up half of the norm, so 2, 2 and 0 from the norm, and the effect adds 2 to chance.
    expect(stats.health.shares.circumstance).toBeCloseTo(2 / 6);
    expect(stats.health.shares.choice).toBeCloseTo(2 / 6);
    expect(stats.health.shares.chance).toBeCloseTo(2 / 6);
    for (const s of Object.values(stats)) {
      expect(s.shares.circumstance + s.shares.choice + s.shares.chance).toBeCloseTo(1);
    }
  });

  it("carries a source on into later years, fading as the stat moves toward its norm", () => {
    // A single shock to health fades by half each year, but a norm that stays is felt every year.
    const shock = [year(0, [stat(-8, "chance")]), year(1), year(2), year(3)];
    const lasting = [0, 1, 2, 3].map((age) => year(age, [], { drift: drift(6, 0, 0) }));
    expect(shaping(shock).stats.health.shares.chance).toBe(1);
    expect(shaping(lasting).stats.health.shares.circumstance).toBe(1);
    // The same shock counts for more the longer it lasts: skills do not fade.
    const skill = (add: number) =>
      event({ effects: [{ effect: { stat: "skills", add }, cause: "chance", delta: add }] });
    const early = shaping([year(0, [skill(5)]), year(1), year(2)]).stats.skills.shares.chance;
    expect(early).toBe(1);
  });

  it("counts a fall as much as a rise", () => {
    const up = shaping([year(0, [stat(5, "chance")], { drift: drift(2, 0, 0) })]).stats.health.shares;
    const down = shaping([year(0, [stat(-5, "chance")], { drift: drift(2, 0, 0) })]).stats.health.shares;
    expect(up.chance).toBeCloseTo(down.chance);
    const shifted = shaping([year(0, [], { drift: drift(-6, 0, 0) })]).stats.health.shares;
    const raised = shaping([year(0, [], { drift: drift(6, 0, 0) })]).stats.health.shares;
    expect(shifted).toEqual(raised);
  });

  it("names the cause behind at least half as the main one, and says mixed otherwise", () => {
    expect(shaping([year(0, [], { drift: drift(8, 1, 1) })]).stats.health.dominant).toBe("circumstance");
    expect(shaping([year(0, [], { drift: drift(0, 8, 1) })]).stats.health.dominant).toBe("choice");
    expect(shaping([year(0, [], { drift: drift(4, 3, 3) })]).stats.health.dominant).toBe("mixed");
    expect(DOMINANT_SHARE).toBe(0.5);
  });

  it("counts effects on one stat toward that stat only", () => {
    const { stats } = shaping([year(0, [stat(6, "choice", "belonging")], { drift: drift(0, 0, 0) })]);
    expect(stats.belonging.dominant).toBe("choice");
    expect(stats.health.dominant).toBe("mixed");
  });

  it("is an even split when nothing moved at all, and the overall is the mean of the four stats", () => {
    expect(shaping([]).stats.health.shares.chance).toBeCloseTo(1 / 3);
    const { stats, overall } = shaping([year(0, [stat(5, "choice")], { drift: drift(0, 0, 0) })]);
    const mean = (cause: "circumstance" | "choice" | "chance") =>
      (stats.health.shares[cause] +
        stats.happiness.shares[cause] +
        stats.belonging.shares[cause] +
        stats.skills.shares[cause]) /
      4;
    expect(overall.choice).toBeCloseTo(mean("choice"));
    expect(overall.chance).toBeCloseTo(mean("chance"));
  });

  it("is computed for every finished life, from records that carry the drift", () => {
    for (let i = 0; i < 12; i++) {
      const life = lived(`shaping-${i}`);
      expect(life.history.every((r) => r.drift !== undefined)).toBe(true);
      const { overall, stats } = summarize(life, country).shaping;
      expect(overall.circumstance + overall.choice + overall.chance).toBeCloseTo(1);
      for (const s of Object.values(stats)) {
        for (const share of Object.values(s.shares)) expect(share).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("has words for every stat and every main cause", () => {
    for (const stat of ["health", "happiness", "belonging", "skills"]) {
      for (const cause of ["circumstance", "choice", "chance", "mixed"]) {
        expect(en, `${stat} ${cause}`).toHaveProperty([`summary.shaped.${stat}.${cause}`]);
      }
    }
  });
});

describe("SUM-001: the summary of a life", () => {
  it("gathers the death, facts, rings, moments and shaping, and the epitaph when there is one", () => {
    const life = lived("summary-1");
    const summary = summarize(withEpitaph(life, "  She kept bees.  "), country);
    expect(summary).toMatchObject({
      seed: "summary-1",
      name: life.person.name,
      sex: life.person.sex,
      countryIso3: life.person.countryIso3,
      epitaph: "She kept bees.",
    });
    expect(summary.death.age).toBe(life.death!.age);
    expect(summary.facts.children).toBe(life.person.relationships.filter((r) => r.kind === "child").length);
    expect(summary.facts.siblings).toBe(life.person.relationships.filter((r) => r.kind === "sibling").length);
    expect(summarize(life, country).epitaph).toBeUndefined();
  });

  it("refuses a life that is still going", () => {
    expect(() => summarize(newLife({ seed: "alive", country }), country)).toThrow(/not ended/);
  });

  it("is plain data, so it can be stored and read back", () => {
    const summary = summarize(lived("summary-json"), country);
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });
});

describe("DEATH-004: the epitaph", () => {
  const life = newLife({ seed: "epitaph", country });
  it("is tidied and kept with the life", () => {
    expect(withEpitaph(life, "  A\n quiet   life ").epitaph).toBe("A quiet life");
  });
  it("is cut to the longest length", () => {
    expect(withEpitaph(life, "x".repeat(500)).epitaph).toHaveLength(EPITAPH_MAX_LENGTH);
  });
  it("is taken away when it is empty", () => {
    expect(withEpitaph(withEpitaph(life, "Kept bees"), "   ")).not.toHaveProperty("epitaph");
  });
  it("does not change the life it belongs to", () => {
    const { epitaph, ...rest } = withEpitaph(life, "Kept bees");
    expect(epitaph).toBe("Kept bees");
    expect(rest).toEqual(life);
  });
});
