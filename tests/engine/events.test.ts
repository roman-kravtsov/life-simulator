import { describe, expect, it } from "vitest";
import {
  MAJOR_PACING_YEARS,
  createCatalog,
  eventProbability,
  pendingFromDef,
  selectEvents,
  type EventDef,
} from "../../src/engine/events";
import { createRng } from "../../src/engine/rng";
import { en } from "../../src/content/strings/en";
import { catalog as contentCatalog, eventDefs } from "../../src/content/events";
import { indicatorValue } from "../../src/engine/conditions";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const def = (overrides: Partial<EventDef> = {}): EventDef => ({
  id: "test.event",
  stage: ["childhood"],
  chance: { kind: "fixed", p: 1 },
  text: "event.test.event",
  ...overrides,
});

const country = makeCountry();

describe("createCatalog (EVENT-001)", () => {
  it("indexes events by stage", () => {
    const catalog = createCatalog([
      def({ id: "a", stage: ["infancy"] }),
      def({ id: "b", stage: ["infancy", "elder"] }),
    ]);
    expect(catalog.forStage("infancy").map((e) => e.id)).toEqual(["a", "b"]);
    expect(catalog.forStage("elder").map((e) => e.id)).toEqual(["b"]);
    expect(catalog.forStage("youth")).toEqual([]);
    expect(catalog.get("b")?.id).toBe("b");
  });
  it.each([
    ["duplicate ids", [def(), def()], /duplicate/i],
    ["no stage", [def({ stage: [] })], /stage/i],
    ["a probability above 1", [def({ chance: { kind: "fixed", p: 1.2 } })], /probability/i],
    ["a non-positive weight", [def({ chance: { kind: "weight", base: 0 } })], /weight/i],
    ["no text key", [def({ text: "" })], /text/i],
    [
      "a choice outcome probability outside 0 to 1",
      [
        def({
          choices: [
            {
              id: "c",
              text: "x",
              outcomes: [
                { p: -1, effects: [], text: "y" },
                { p: 2, effects: [], text: "z" },
              ],
            },
          ],
        }),
      ],
      /between 0 and 1/i,
    ],
    [
      "choice outcomes that do not sum to 1",
      [def({ choices: [{ id: "c", text: "x", outcomes: [{ p: 0.5, effects: [], text: "y" }] }] })],
      /sum to 1/i,
    ],
  ])("rejects %s", (_name, defs, message) => {
    expect(() => createCatalog(defs as EventDef[])).toThrow(message);
  });
});

describe("data notes", () => {
  const withNote = def({ dataNote: { text: "note.unemployment", path: "work.unemployment" } });
  it("carries the value, source and year of an observed indicator", () => {
    const pending = pendingFromDef(withNote, makePerson(), country);
    expect(pending.dataNote).toEqual({ textKey: "note.unemployment", value: 0.06, source: "test", year: 2023 });
  });
  it("leaves the note out for an estimated indicator, which is never shown as a fact about the country", () => {
    const estimated = makeCountry({
      work: { ...country.work, unemployment: { ...country.work.unemployment, estimated: true } },
    });
    expect(pendingFromDef(withNote, makePerson(), estimated).dataNote).toBeUndefined();
  });
});

describe("eventProbability", () => {
  const person = makePerson();
  it("uses a fixed probability", () => {
    expect(eventProbability(def({ chance: { kind: "fixed", p: 0.3 } }), person, country)).toBeCloseTo(0.3);
  });
  it("reads an indicator and scales it", () => {
    const chance = { kind: "indicator", path: "work.unemployment", scale: 2 } as const;
    expect(eventProbability(def({ chance }), person, country)).toBeCloseTo(0.12);
  });
  it("clamps to 1", () => {
    const chance = { kind: "indicator", path: "work.unemployment", scale: 100 } as const;
    expect(eventProbability(def({ chance }), person, country)).toBe(1);
  });
});

describe("selectEvents", () => {
  const select = (
    defs: EventDef[],
    person = makePerson(),
    history: Parameters<typeof selectEvents>[0]["history"] = [],
    seed = "s",
    options: Partial<Parameters<typeof selectEvents>[0]> = {},
  ) =>
    selectEvents({ catalog: createCatalog(defs), person, country, history, rng: createRng(seed), ...options }).map(
      (e) => e.id,
    );
  /** A major event last year, so the pacing guarantee is not in play. */
  const recentMajor = [{ age: 10, events: [{ id: "major" }] }];

  it("picks only events for the person's stage whose conditions hold", () => {
    const defs = [
      def({ id: "stage-ok" }),
      def({ id: "wrong-stage", stage: ["elder"] }),
      def({ id: "cond-fails", conditions: [{ age: [30, 40] }] }),
    ];
    expect(select(defs)).toEqual(["stage-ok"]);
  });
  it("rolls statistical events independently, so p=0 never fires and p=1 always does", () => {
    const defs = [def({ id: "never", chance: { kind: "fixed", p: 0 } }), def({ id: "always" })];
    for (let i = 0; i < 20; i++) expect(select(defs, makePerson(), [], `s${i}`)).toEqual(["always"]);
  });
  it("does not repeat a once-only event", () => {
    const once = def({ id: "once", once: true });
    expect(select([once])).toEqual(["once"]);
    const history = [{ age: 9, events: [{ id: "once" }] }];
    expect(select([once], makePerson(), history)).toEqual([]);
  });
  it("respects a cooldown in years", () => {
    const cool = def({ id: "cool", cooldownYears: 3 });
    expect(select([cool], makePerson({ age: 10 }), [{ age: 9, events: [{ id: "cool" }] }])).toEqual([]);
    expect(select([cool], makePerson({ age: 10 }), [{ age: 8, events: [{ id: "cool" }] }])).toEqual(["cool"]);
  });
  it("draws narrative events from a weighted pool: at most one major and two minor, often none", () => {
    const defs = [
      def({ id: "major", tier: "major", chance: { kind: "weight", base: 5 } }),
      def({ id: "minor1", tier: "minor", chance: { kind: "weight", base: 5 } }),
      def({ id: "minor2", tier: "minor", chance: { kind: "weight", base: 5 } }),
      def({ id: "minor3", tier: "minor", chance: { kind: "weight", base: 5 } }),
    ];
    let none = 0;
    for (let i = 0; i < 300; i++) {
      const picked = select(defs, makePerson(), recentMajor, `pool${i}`);
      expect(picked.filter((id) => id === "major").length).toBeLessThanOrEqual(1);
      expect(picked.filter((id) => id.startsWith("minor")).length).toBeLessThanOrEqual(2);
      expect(new Set(picked).size).toBe(picked.length);
      if (picked.length === 0) none++;
    }
    expect(none).toBeGreaterThan(0);
    expect(none).toBeLessThan(300);
  });
  it("applies weight modifiers when their conditions hold", () => {
    const boosted = def({
      id: "boosted",
      tier: "major",
      chance: { kind: "weight", base: 1, modifiers: [{ when: [{ location: "rural" }], multiply: 50 }] },
    });
    const count = (location: "rural" | "urban") => {
      let n = 0;
      for (let i = 0; i < 300; i++)
        n += select([boosted], makePerson({ location }), [{ age: 10, events: [{ id: "boosted" }] }], `m${i}`).length;
      return n;
    };
    expect(count("rural")).toBeGreaterThan(count("urban") * 3);
  });
  it("draws the minor pool from its own stream, so adding a major event never reshuffles the minor picks", () => {
    const minors = [
      def({ id: "minor1", tier: "minor", chance: { kind: "weight", base: 5 } }),
      def({ id: "minor2", tier: "minor", chance: { kind: "weight", base: 5 } }),
      def({ id: "minor3", tier: "minor", chance: { kind: "weight", base: 5 } }),
    ];
    const major = def({ id: "major", tier: "major", chance: { kind: "weight", base: 5 } });
    const run = (defs: EventDef[], seed: string) =>
      selectEvents({
        catalog: createCatalog(defs),
        person: makePerson(),
        country,
        history: [],
        rng: createRng(seed),
        rollFor: (id) => createRng(`${seed}:${id}`),
      })
        .map((e) => e.id)
        .filter((id) => id.startsWith("minor"));
    for (let i = 0; i < 100; i++) expect(run([...minors, major], `p${i}`)).toEqual(run(minors, `p${i}`));
  });
  const withChoice = def({
    id: "choice",
    choices: [{ id: "c", text: "x", outcomes: [{ p: 1, effects: [], text: "y" }] }],
  });
  it("offers events with choices (DEC-001) while the year has room for a decision, and holds them back when it has none", () => {
    expect(select([withChoice])).toEqual(["choice"]);
    expect(select([withChoice], makePerson(), [], "s", { allowChoices: false })).toEqual([]);
  });
  it("brings a scheduled follow-up when it is due, ahead of the rolls, and not before (EVENT-004)", () => {
    const followUp = def({ id: "follow", chance: { kind: "scheduled" } });
    const person = (age: number, due: number) => makePerson({ age, scheduled: [{ id: "follow", age: due }] });
    expect(select([followUp], person(10, 10))).toEqual(["follow"]);
    expect(select([followUp], person(11, 10))).toEqual(["follow"]);
    expect(select([followUp], person(9, 10))).toEqual([]);
    expect(select([followUp], makePerson())).toEqual([]);
    const both = select([followUp, def({ id: "always" })], person(10, 10));
    expect(both[0]).toBe("follow");
  });
  it("never rolls an event that is only ever scheduled", () => {
    const followUp = def({ id: "follow", chance: { kind: "scheduled" } });
    for (let i = 0; i < 20; i++) expect(select([followUp], makePerson(), [], `s${i}`)).toEqual([]);
  });
  it("skips severe narrative events when softening is on, but not severe statistical ones (EVENT-006)", () => {
    const severeNarrative = def({
      id: "narrative",
      sensitivity: "severe",
      helpTopic: "grief",
      tier: "major",
      chance: { kind: "weight", base: 1000 },
    });
    const severeStatistical = def({ id: "statistical", sensitivity: "severe", helpTopic: "grief" });
    const mild = def({ id: "mild", tier: "major", chance: { kind: "weight", base: 1000 } });
    let narrativeOff = 0;
    for (let i = 0; i < 50; i++) {
      const defs = [severeNarrative, severeStatistical, mild];
      const soft = select(defs, makePerson(), recentMajor, `soft${i}`, { softening: true });
      expect(soft).not.toContain("narrative");
      expect(soft).toContain("statistical");
      if (select(defs, makePerson(), recentMajor, `soft${i}`).includes("narrative")) narrativeOff++;
    }
    expect(narrativeOff).toBeGreaterThan(0);
  });
  it("guarantees a major event after MAJOR_PACING_YEARS without one (design 3.4)", () => {
    const major = def({ id: "major", tier: "major", chance: { kind: "weight", base: 1 } });
    let quietPicks = 0;
    let overduePicks = 0;
    for (let i = 0; i < 100; i++) {
      if (select([major], makePerson({ age: 10 }), [{ age: 10, events: [{ id: "major" }] }], `q${i}`).length === 0)
        quietPicks++;
      const overdue = [{ age: 10 - MAJOR_PACING_YEARS + 1, events: [{ id: "major" }] }];
      if (select([major], makePerson({ age: 10 }), overdue, `q${i}`).length === 1) overduePicks++;
    }
    expect(quietPicks).toBeGreaterThan(50);
    expect(overduePicks).toBe(100);
  });
  it("needs a living relative for each role the text speaks of, and names them (REL-002)", () => {
    const friend = {
      id: "f1",
      kind: "friend" as const,
      name: "Ines",
      sex: "female" as const,
      age: 10,
      alive: true,
      closeness: 50,
    };
    const aboutFriend = def({
      id: "friend",
      roles: ["friend"],
      effects: [{ relationship: "closeness", amount: 5, role: "friend" }],
    });
    expect(select([aboutFriend])).toEqual([]);
    expect(select([aboutFriend], makePerson({ relationships: [{ ...friend, alive: false }] }))).toEqual([]);
    const withFriend = makePerson({ relationships: [friend] });
    expect(select([aboutFriend], withFriend)).toEqual(["friend"]);
    const pending = pendingFromDef(aboutFriend, withFriend, country, { rng: createRng("cast") });
    expect(pending.vars).toEqual({ friend: "Ines" });
    expect(pending.effects).toEqual([{ relationship: "closeness", amount: 5, id: "f1" }]);
  });
  it("marks a decision, quiet texture, and a shorter telling for softening on the pending event", () => {
    const pending = pendingFromDef(
      def({
        id: "hard",
        quiet: true,
        sensitivity: "difficult",
        helpTopic: "grief",
        softText: "event.test.soft",
        choices: withChoice.choices,
      }),
      makePerson(),
      country,
    );
    expect(pending.ask?.eventId).toBe("hard");
    expect(pending.quiet).toBe(true);
    expect(pending.softTextKey).toBe("event.test.soft");
  });
  it("reads the complement of an indicator for a data note when asked", () => {
    const note = def({ dataNote: { text: "note.unemployment", path: "work.unemployment", invert: true } });
    expect(pendingFromDef(note, makePerson(), country).dataNote?.value).toBeCloseTo(0.94);
  });
  it("makes a weighted event likelier with points in the area it belongs to (DEC-003)", () => {
    const studious = def({ id: "studious", tier: "major", focus: "learn", chance: { kind: "weight", base: 4 } });
    const picks = (units: number) => {
      let n = 0;
      for (let i = 0; i < 400; i++)
        n += select(
          [studious],
          makePerson({ focus: { learn: units } }),
          [{ age: 10, events: [{ id: "studious" }] }],
          `f${i}`,
        ).length;
      return n;
    };
    expect(picks(2)).toBeGreaterThan(picks(-1));
  });
  it("is deterministic for the same seed", () => {
    const defs = [
      def({ id: "a", tier: "minor", chance: { kind: "weight", base: 3 } }),
      def({ id: "b", tier: "minor", chance: { kind: "weight", base: 3 } }),
    ];
    expect(select(defs, makePerson(), [], "same")).toEqual(select(defs, makePerson(), [], "same"));
  });
});

describe("shipped event content", () => {
  it("loads into a catalog", () => {
    expect(eventDefs.length).toBeGreaterThanOrEqual(10);
    expect(contentCatalog.get(eventDefs[0]!.id)).toBeDefined();
  });
  it("has a string for every text key", () => {
    for (const e of eventDefs) {
      expect(en, e.id).toHaveProperty([e.text]);
      if (e.dataNote) expect(en, e.id).toHaveProperty([e.dataNote.text]);
    }
  });
  it("only reads world indicators that exist in the country schema", () => {
    const paths = new Set<string>();
    for (const e of eventDefs) {
      if (e.chance.kind === "indicator") paths.add(e.chance.path);
      if (e.dataNote) paths.add(e.dataNote.path);
      for (const c of e.conditions ?? []) if ("world" in c) paths.add(c.world);
      if (e.chance.kind === "weight")
        for (const m of e.chance.modifiers ?? []) for (const c of m.when) if ("world" in c) paths.add(c.world);
    }
    for (const path of paths) expect(() => indicatorValue(country, path, "female"), path).not.toThrow();
  });
  it("covers every stage with at least one event", () => {
    for (const stage of ["infancy", "childhood", "adolescence", "youth", "adulthood", "midlife", "elder"] as const) {
      expect(contentCatalog.forStage(stage).length, stage).toBeGreaterThan(0);
    }
  });
  it("tags sensitive events", () => {
    for (const e of eventDefs) if (e.helpTopic) expect(e.sensitivity, e.id).toBeDefined();
  });
});
