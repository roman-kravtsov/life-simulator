// The event set against what docs/mvp.md promises (EVENT-007), and the pacing it produces.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog, eventDefs } from "../../src/content/events";
import { conditionDefs } from "../../src/content/healthConditions";
import { CONTENT_VERSION } from "../../src/content/version";
import { isDecision, selectEvents, type EventDef } from "../../src/engine/events";
import { advanceAuto, newLife } from "../../src/engine/life";
import { stream } from "../../src/engine/rng";
import type { LifeStage } from "../../src/engine/types";
import type { Country } from "../../src/engine/world/types";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const real = (iso3: string) => JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;
const inStages = (...stages: LifeStage[]) => eventDefs.filter((e) => e.stage.some((s) => stages.includes(s)));
const money = (e: EventDef) =>
  (e.effects ?? []).some((f) => "money" in f && f.money === "cost") && e.chance.kind !== "scheduled";

describe("the event set's size (EVENT-007)", () => {
  it("has about 140 events, spread over the stages as docs/mvp.md says", () => {
    expect(eventDefs.length).toBeGreaterThanOrEqual(150);
    expect(inStages("infancy", "childhood").length).toBeGreaterThanOrEqual(30);
    expect(inStages("adolescence").length).toBeGreaterThanOrEqual(25);
    expect(inStages("youth").length).toBeGreaterThanOrEqual(30);
    expect(inStages("adulthood").length).toBeGreaterThanOrEqual(25);
    expect(inStages("midlife").length).toBeGreaterThanOrEqual(15);
    expect(inStages("elder").length).toBeGreaterThanOrEqual(15);
  });
  it("has about 35 decisions, at least 5 in every stage from age 6", () => {
    expect(eventDefs.filter(isDecision).length).toBeGreaterThanOrEqual(35);
    for (const stage of ["childhood", "adolescence", "youth", "adulthood", "midlife", "elder"] as const) {
      expect(inStages(stage).filter(isDecision).length, stage).toBeGreaterThanOrEqual(5);
    }
  });
  it("has events about friends, and about closeness with family", () => {
    expect(eventDefs.filter((e) => e.roles?.includes("friend")).length).toBeGreaterThanOrEqual(8);
    const closeness = eventDefs.filter((e) => (e.effects ?? []).some((f) => "role" in f));
    expect(closeness.length).toBeGreaterThanOrEqual(10);
  });
  it("has at least 6 money shocks (MONEY-006)", () => {
    expect(eventDefs.filter(money).length).toBeGreaterThanOrEqual(6);
  });
  it("has about 25 data notes (EVENT-005)", () => {
    expect(eventDefs.filter((e) => e.dataNote).length).toBeGreaterThanOrEqual(25);
  });
  it("has sensitive events that softening can leave out, each with a help topic", () => {
    const severe = eventDefs.filter((e) => e.sensitivity === "severe");
    expect(severe.length).toBeGreaterThanOrEqual(3);
    for (const e of eventDefs.filter((e) => e.sensitivity === "severe" || e.sensitivity === "difficult")) {
      expect(e.helpTopic, e.id).toBeDefined();
      expect(e.softText, e.id).toBeDefined();
    }
  });
});

describe("how often events can come back (EVENT-007)", () => {
  it("lets only quiet texture events, and events that happen once, come round more often than every 6 years", () => {
    for (const e of eventDefs) {
      if (e.quiet || e.once || e.chance.kind === "scheduled") continue;
      expect(e.cooldownYears ?? 0, e.id).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("softening (EVENT-006) on the shipped events", () => {
  it("never picks a severe event when it is on", () => {
    const country = makeCountry({ region: "Western Africa" });
    for (let i = 0; i < 300; i++) {
      for (const stage of ["childhood", "adolescence", "midlife"] as const) {
        const picked = selectEvents({
          catalog,
          person: makePerson({ age: stage === "childhood" ? 9 : stage === "adolescence" ? 14 : 55, stage }),
          country,
          history: [],
          rng: stream(`soft-${i}`, "events", 1),
          softening: true,
        });
        expect(picked.filter((e) => e.sensitivity === "severe")).toEqual([]);
      }
    }
  });
});

describe("a life with the shipped events", () => {
  const lives = (iso3: string, n: number) => {
    const country = real(iso3);
    let years = 0;
    let notable = 0;
    let repeats = 0;
    let decisions = 0;
    for (let i = 0; i < n; i++) {
      let state = newLife({ seed: `content-${i}`, country, settings: { pace: "every-year" } });
      while (state.person.alive) state = advanceAuto(state, country);
      const seen = new Set<string>();
      for (const record of state.history) {
        years++;
        for (const event of record.events) {
          if (event.decision) decisions++;
          const def = catalog.get(event.id);
          if (!def || def.quiet) continue;
          notable++;
          if (seen.has(event.id) && !def.tags?.includes("money")) repeats++;
          seen.add(event.id);
        }
      }
    }
    return { years: years / n, notable: notable / n, repeats: repeats / n, decisions: decisions / n };
  };
  for (const iso3 of ["NGA", "JPN"]) {
    it(`gives a life in ${iso3} about one notable event a year, few repeats and a decision every few years`, () => {
      const { years, notable, repeats, decisions } = lives(iso3, 60);
      expect(notable / years).toBeGreaterThan(0.5);
      expect(notable / years).toBeLessThan(1.1);
      expect(repeats / notable).toBeLessThan(0.15);
      expect(decisions / years).toBeGreaterThan(0.06);
      expect(decisions / years).toBeLessThan(0.22);
    });
  }
});

/** FNV-1a, enough to notice that something changed. */
const fingerprint = (text: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(16);
};

describe("the content version (SAVE-004, RNG-004)", () => {
  // A save records the content version, and a replay is exact only for the same one. This pins the version
  // against a fingerprint of the events and conditions as data (functions are not part of it, so it is a
  // reminder, not a proof). When this fails: bump CONTENT_VERSION in src/content/version.ts, then update the pin.
  it("is bumped when the events or conditions change", () => {
    expect([CONTENT_VERSION, fingerprint(JSON.stringify([eventDefs, conditionDefs]))]).toEqual([
      "2026.10.3",
      "6c8fabef",
    ]);
  });
});
