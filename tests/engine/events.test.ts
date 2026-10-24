import { describe, expect, it } from "vitest";
import { createCatalog, eventProbability, selectEvents, type EventDef } from "../../src/engine/events";
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
    const catalog = createCatalog([def({ id: "a", stage: ["infancy"] }), def({ id: "b", stage: ["infancy", "elder"] })]);
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
      "choice outcomes that do not sum to 1",
      [def({ choices: [{ id: "c", text: "x", outcomes: [{ p: 0.5, effects: [], text: "y" }] }] })],
      /sum to 1/i,
    ],
  ])("rejects %s", (_name, defs, message) => {
    expect(() => createCatalog(defs as EventDef[])).toThrow(message);
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
  const select = (defs: EventDef[], person = makePerson(), history: Parameters<typeof selectEvents>[0]["history"] = [], seed = "s") =>
    selectEvents({ catalog: createCatalog(defs), person, country, history, rng: createRng(seed) }).map((e) => e.id);

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
    expect(select([cool], makePerson({ age: 10 }), [{ age: 8, events: [{ id: "cool" }] }])).toEqual([]);
    expect(select([cool], makePerson({ age: 10 }), [{ age: 7, events: [{ id: "cool" }] }])).toEqual(["cool"]);
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
      const picked = select(defs, makePerson(), [], `pool${i}`);
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
      for (let i = 0; i < 300; i++) n += select([boosted], makePerson({ location }), [], `m${i}`).length;
      return n;
    };
    expect(count("rural")).toBeGreaterThan(count("urban") * 3);
  });
  it("skips events with choices until decisions arrive (DEC-001)", () => {
    const withChoice = def({
      id: "choice",
      choices: [{ id: "c", text: "x", outcomes: [{ p: 1, effects: [], text: "y" }] }],
    });
    expect(select([withChoice])).toEqual([]);
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
      if (e.chance.kind === "weight") for (const m of e.chance.modifiers ?? []) for (const c of m.when) if ("world" in c) paths.add(c.world);
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
