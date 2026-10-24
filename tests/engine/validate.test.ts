import { describe, expect, it } from "vitest";
import { conditionCatalog } from "../../src/content/healthConditions";
import { eventDefs } from "../../src/content/events";
import { en } from "../../src/content/strings/en";
import type { EventDef } from "../../src/engine/events";
import { systemDecisions } from "../../src/engine/systemDecisions";
import { validateConditions, validateEvents } from "../../src/engine/validate";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const country = makeCountry({ region: "Western Africa" });
const strings: Record<string, string> = {
  "event.ok": "Something happens.",
  "help.grief": "Help exists.",
  "note.ok": "About {share} of people",
  "choice.a": "A",
  "choice.b": "B",
  "outcome.a": "It goes well.",
  "outcome.b": "It goes badly.",
  "lens.good": "it goes well",
  "lens.bad": "it goes badly",
};
const base: EventDef = {
  id: "test.ok",
  stage: ["childhood"],
  chance: { kind: "weight", base: 1 },
  text: "event.ok",
};
const check = (...defs: EventDef[]) =>
  validateEvents({ events: defs, strings, country, person: makePerson(), conditions: conditionCatalog });

describe("validateEvents (ADMIN-001)", () => {
  it("accepts a well-formed event", () => {
    expect(check(base)).toEqual([]);
  });
  it("finds a missing text key, a soft text key and a note key", () => {
    const problems = check({
      ...base,
      text: "event.missing",
      sensitivity: "difficult",
      helpTopic: "grief",
      softText: "event.missing.soft",
      dataNote: { text: "note.missing", path: "work.unemployment" },
    });
    expect(problems.join("\n")).toMatch(/event\.missing\b/);
    expect(problems.join("\n")).toMatch(/event\.missing\.soft/);
    expect(problems.join("\n")).toMatch(/note\.missing/);
  });
  it("finds a world path that does not exist, in conditions, modifiers, notes and chances", () => {
    expect(check({ ...base, conditions: [{ world: "work.nope", op: ">", value: 1 }] }).join()).toMatch(/work\.nope/);
    expect(
      check({
        ...base,
        chance: { kind: "weight", base: 1, modifiers: [{ when: [{ world: "x.y", op: ">", value: 0 }], multiply: 2 }] },
      }).join(),
    ).toMatch(/x\.y/);
    expect(check({ ...base, dataNote: { text: "note.ok", path: "a.b" } }).join()).toMatch(/a\.b/);
    expect(check({ ...base, chance: { kind: "indicator", path: "c.d" } }).join()).toMatch(/c\.d/);
  });
  it("needs a note to use one of its variables", () => {
    const flat = { ...strings, "note.flat": "No variable here" };
    const problems = validateEvents({
      events: [{ ...base, dataNote: { text: "note.flat", path: "work.unemployment" } }],
      strings: flat,
      country,
      person: makePerson(),
      conditions: conditionCatalog,
    });
    expect(problems.join()).toMatch(/note\.flat/);
  });
  it("needs a help topic, and its text, for a sensitive event", () => {
    expect(check({ ...base, sensitivity: "difficult" }).join()).toMatch(/help topic/);
    expect(check({ ...base, sensitivity: "severe" }).join()).toMatch(/help topic/);
    expect(check({ ...base, sensitivity: "none" })).toEqual([]);
    expect(check({ ...base, sensitivity: "difficult", helpTopic: "addiction" }).join()).toMatch(/help\.addiction/);
  });
  it("finds a text that speaks of someone the event has no role for", () => {
    const withRole = { ...strings, "event.ok": "{friend} calls." };
    const run = (roles: EventDef["roles"]) =>
      validateEvents({
        events: [{ ...base, ...(roles ? { roles } : {}) }],
        strings: withRole,
        country,
        person: makePerson(),
        conditions: conditionCatalog,
      });
    expect(run(undefined).join()).toMatch(/friend/);
    expect(run(["friend"])).toEqual([]);
  });
  it("finds a closeness effect aimed at a role the event does not cast", () => {
    expect(check({ ...base, effects: [{ relationship: "closeness", amount: 1, role: "friend" }] }).join()).toMatch(
      /friend/,
    );
  });
  it("finds a follow-up that does not exist or is not scheduled", () => {
    expect(check({ ...base, effects: [{ schedule: "test.nowhere", inYears: 1 }] }).join()).toMatch(/test\.nowhere/);
    expect(check(base, { ...base, id: "test.b", effects: [{ schedule: "test.ok", inYears: 1 }] }).join()).toMatch(
      /scheduled/,
    );
  });
  it("finds a condition or a care effect that names an illness that does not exist", () => {
    expect(check({ ...base, effects: [{ condition: "add", id: "nope", severity: 1 }] }).join()).toMatch(/nope/);
  });

  const choice = (overrides = {}) => ({
    id: "a",
    text: "choice.a",
    outcomes: [{ p: 1, text: "outcome.a", effects: [] }],
    ...overrides,
  });
  const decision = (choices: NonNullable<EventDef["choices"]>): EventDef => ({ ...base, choices });
  it("accepts a decision with a clear lens", () => {
    expect(
      check(
        decision([
          choice({
            outcomes: [
              { p: 0.5, text: "outcome.a", lens: "lens.good", effects: [] },
              { p: 0.5, text: "outcome.b", lens: "lens.bad", effects: [] },
            ],
          }),
          choice({ id: "b", text: "choice.b" }),
        ]),
      ),
    ).toEqual([]);
  });
  it("finds choice, outcome and lens problems", () => {
    expect(check(decision([choice({ text: "choice.none" })])).join()).toMatch(/choice\.none/);
    expect(check(decision([choice({ outcomes: [{ p: 1, text: "outcome.none", effects: [] }] })])).join()).toMatch(
      /outcome\.none/,
    );
    const noLens = choice({
      outcomes: [
        { p: 0.5, text: "outcome.a", effects: [] },
        { p: 0.5, text: "outcome.b", effects: [] },
      ],
    });
    expect(check(decision([noLens])).join()).toMatch(/lens/);
    const badLens = choice({
      outcomes: [
        { p: 0.5, text: "outcome.a", lens: "lens.none", effects: [] },
        { p: 0.5, text: "outcome.b", lens: "lens.bad", effects: [] },
      ],
    });
    expect(check(decision([badLens])).join()).toMatch(/lens\.none/);
  });
  it("finds a lock without text, two defaults and duplicate choice ids", () => {
    expect(check(decision([choice({ locks: [{ unless: [{ has: "job" }], reason: "lock.none" }] })])).join()).toMatch(
      /lock\.none/,
    );
    expect(
      check(decision([choice({ default: true }), choice({ id: "b", text: "choice.b", default: true })])).join(),
    ).toMatch(/default/);
    expect(check(decision([choice(), choice()])).join()).toMatch(/twice/);
  });
  it("finds effects that throw, and effects that name a role the event does not cast", () => {
    const throws = choice({
      outcomes: [
        {
          p: 1,
          text: "outcome.a",
          effects: () => {
            throw new Error("boom");
          },
        },
      ],
    });
    expect(check(decision([throws])).join()).toMatch(/boom/);
  });
  it("needs at least two choices, so that a decision is a choice", () => {
    expect(check(decision([choice()])).join()).toMatch(/at least two/);
  });
  it("finds a duplicate event id", () => {
    expect(check(base, base).join()).toMatch(/twice/);
  });
});

describe("validateConditions", () => {
  it("accepts the shipped conditions", () => {
    expect(validateConditions({ conditions: conditionCatalog.all, strings: en })).toEqual([]);
  });
  it("finds missing strings", () => {
    const problems = validateConditions({
      conditions: [
        {
          id: "x",
          ages: [0, 100],
          onset: 0.1,
          worsen: 0.1,
          recover: 0.1,
          hazard: 0.1,
          healthPenalty: 1,
          focusCost: [0, 1, 2],
        },
      ],
      strings: {},
    });
    expect(problems.join()).toMatch(/condition\.x/);
    expect(problems.join()).toMatch(/event\.condition\.x\.begins/);
  });
});

describe("the shipped events and decisions", () => {
  const run = (events: readonly EventDef[], exercise: boolean) =>
    validateEvents({ events, strings: en, country, person: makePerson(), conditions: conditionCatalog, exercise });
  it("pass validation", () => {
    expect(run(eventDefs, true)).toEqual([]);
  });
  it("include the engine's own decisions, which pass too", () => {
    expect(run(systemDecisions, false)).toEqual([]);
  });
});
