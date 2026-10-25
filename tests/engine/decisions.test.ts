import { describe, expect, it } from "vitest";
import {
  choiceViews,
  defaultChoiceId,
  lensFor,
  lockReason,
  oddsBand,
  outcomeProbabilities,
  resolveChoice,
  visibleChoices,
  type ChoiceDef,
  type DecisionContext,
} from "../../src/engine/decisions";
import { createRng } from "../../src/engine/rng";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const country = makeCountry();
const ctx = (overrides: Partial<DecisionContext> = {}): DecisionContext => ({
  person: makePerson(),
  country,
  payload: {},
  ...overrides,
});

const choice = (overrides: Partial<ChoiceDef> = {}): ChoiceDef => ({
  id: "go",
  text: "choice.go",
  outcomes: [{ p: 1, text: "outcome.go", effects: [{ stat: "skills", add: 2 }] }],
  ...overrides,
});

describe("odds bands (DEC-005)", () => {
  it.each([
    [0, { kind: "almostNever" }],
    [0.01, { kind: "almostNever" }],
    [0.05, { kind: "fraction", num: 1, den: 20 }],
    [0.1, { kind: "fraction", num: 1, den: 10 }],
    [0.2, { kind: "fraction", num: 1, den: 5 }],
    [0.25, { kind: "fraction", num: 1, den: 4 }],
    [0.33, { kind: "fraction", num: 1, den: 3 }],
    [0.5, { kind: "fraction", num: 1, den: 2 }],
    [0.66, { kind: "fraction", num: 2, den: 3 }],
    [0.75, { kind: "fraction", num: 3, den: 4 }],
    [0.8, { kind: "fraction", num: 4, den: 5 }],
    [0.9, { kind: "fraction", num: 9, den: 10 }],
    [0.97, { kind: "almostSure" }],
    [1, { kind: "almostSure" }],
  ])("puts %s into its band", (p, band) => {
    expect(oddsBand(p)).toEqual(band);
  });
  it("never names a band further than a small step from the real chance", () => {
    for (let p = 0.02; p < 0.95; p += 0.01) {
      const band = oddsBand(p);
      if (band.kind !== "fraction") throw new Error("expected a fraction");
      expect(Math.abs(band.num / band.den - p)).toBeLessThan(0.1);
    }
  });
  it("is monotonic", () => {
    let last = 0;
    for (let p = 0.02; p < 0.95; p += 0.005) {
      const band = oddsBand(p);
      if (band.kind !== "fraction") throw new Error("expected a fraction");
      expect(band.num / band.den).toBeGreaterThanOrEqual(last);
      last = band.num / band.den;
    }
  });
});

describe("outcome probabilities", () => {
  it("are the numbers given when they add up to one", () => {
    const c = choice({
      outcomes: [
        { p: 0.25, text: "a", effects: [], lens: "l.a" },
        { p: 0.75, text: "b", effects: [], lens: "l.b" },
      ],
    });
    expect(outcomeProbabilities(c, ctx())).toEqual([0.25, 0.75]);
  });
  it("are weights shifted by modifiers that hold, then normalised", () => {
    const c = choice({
      outcomes: [
        {
          p: { weight: 1, modifiers: [{ when: [{ location: "rural" }], multiply: 3 }] },
          text: "a",
          effects: [],
          lens: "x",
        },
        { p: { weight: 1 }, text: "b", effects: [], lens: "y" },
      ],
    });
    expect(outcomeProbabilities(c, ctx({ person: makePerson({ location: "urban" }) }))).toEqual([0.5, 0.5]);
    expect(outcomeProbabilities(c, ctx({ person: makePerson({ location: "rural" }) }))).toEqual([0.75, 0.25]);
  });
  it("can come from a function of the person", () => {
    const c = choice({
      outcomes: [
        { p: ({ person }) => person.stats.skills / 100, text: "a", effects: [], lens: "x" },
        { p: ({ person }) => 1 - person.stats.skills / 100, text: "b", effects: [], lens: "y" },
      ],
    });
    expect(
      outcomeProbabilities(
        c,
        ctx({ person: makePerson({ stats: { health: 1, happiness: 1, belonging: 1, skills: 30 } }) }),
      )[0],
    ).toBeCloseTo(0.3);
  });
  it("refuse a choice with no chance at all", () => {
    expect(() => outcomeProbabilities(choice({ outcomes: [{ p: 0, text: "a", effects: [] }] }), ctx())).toThrow(
      /no chance/,
    );
  });
});

describe("hidden and locked choices (DEC-002)", () => {
  const def = {
    id: "d",
    choices: [
      choice({ id: "open" }),
      choice({ id: "hidden", requires: [{ has: "partner" }] }),
      choice({ id: "locked", locks: [{ unless: [{ has: "savings" }], reason: "lock.needs_savings" }] }),
      choice({ id: "computed", locks: [{ when: ({ person }) => person.age < 12, reason: "lock.too_young" }] }),
    ],
  };
  it("hides what requires something missing, and shows the rest", () => {
    expect(visibleChoices(def, ctx()).map((c) => c.id)).toEqual(["open", "locked", "computed"]);
  });
  it("locks with a reason the player can read", () => {
    const poor = ctx();
    expect(lockReason(def.choices[2]!, poor)).toBe("lock.needs_savings");
    expect(lockReason(def.choices[3]!, poor)).toBe("lock.too_young");
    const saver = ctx({ person: makePerson({ age: 20, money: { ...makePerson().money, savings: 5 } }) });
    expect(lockReason(def.choices[2]!, saver)).toBeUndefined();
    expect(lockReason(def.choices[3]!, saver)).toBeUndefined();
  });
  it("gives the card the reason for each locked choice", () => {
    const views = choiceViews(def, ctx());
    expect(views.find((v) => v.id === "locked")?.lockedReason).toBe("lock.needs_savings");
    expect(views.find((v) => v.id === "open")?.lockedReason).toBeUndefined();
  });
  it("refuses to take a locked or hidden choice", () => {
    expect(() => resolveChoice(def, "locked", ctx(), createRng("x"))).toThrow(/locked/);
    expect(() => resolveChoice(def, "hidden", ctx(), createRng("x"))).toThrow(/Unknown choice/);
  });
});

describe("the odds lens (DEC-005)", () => {
  const risky = choice({
    outcomes: [
      { p: 0.2, text: "a", effects: [], lens: "lens.win" },
      { p: 0.8, text: "b", effects: [], lens: "lens.lose" },
    ],
  });
  it("lists every outcome of a probabilistic choice in bands that match the probabilities rolled", () => {
    const lens = lensFor(risky, ctx());
    expect(lens.map((l) => l.key)).toEqual(["lens.win", "lens.lose"]);
    const probabilities = outcomeProbabilities(risky, ctx());
    lens.forEach((line, i) => {
      expect(line.p).toBe(probabilities[i]);
      expect(line.band).toEqual(oddsBand(probabilities[i]!));
    });
  });
  it("adds the lines the engine works out, with what they would be otherwise", () => {
    const withLine = choice({ lens: () => [{ key: "lens.degree", p: 0.3, vs: 0.1 }] });
    const [line] = lensFor(withLine, ctx());
    expect(line).toMatchObject({ key: "lens.degree", p: 0.3, band: { num: 1, den: 3 }, vsBand: { num: 1, den: 10 } });
  });
  it("says nothing about a choice with a single certain outcome", () => {
    expect(lensFor(choice(), ctx())).toEqual([]);
  });
  it("matches how often each outcome happens when it is rolled", () => {
    const rolls = 4000;
    const counts = [0, 0];
    for (let i = 0; i < rolls; i++) {
      const resolved = resolveChoice({ id: "d", choices: [risky] }, "go", ctx(), createRng(`roll${i}`));
      counts[resolved.outcome === risky.outcomes[0] ? 0 : 1]!++;
    }
    expect(counts[0]! / rolls).toBeGreaterThan(0.17);
    expect(counts[0]! / rolls).toBeLessThan(0.23);
  });
});

describe("resolving a choice (DEC-001)", () => {
  it("applies the chosen outcome's effects and records what was chosen", () => {
    const resolved = resolveChoice({ id: "d", choices: [choice()] }, "go", ctx(), createRng("r"));
    expect(resolved.effects).toEqual([{ stat: "skills", add: 2 }]);
    expect(resolved.record).toEqual({ choiceId: "go", choiceTextKey: "choice.go", outcomeTextKey: "outcome.go" });
  });
  it("calls the effect a choice when there is one outcome, and chance when the dice decide", () => {
    expect(resolveChoice({ id: "d", choices: [choice()] }, "go", ctx(), createRng("r")).cause).toBe("choice");
    const dice = choice({
      outcomes: [
        { p: 0.5, text: "a", effects: [], lens: "x" },
        { p: 0.5, text: "b", effects: [], lens: "y" },
      ],
    });
    expect(resolveChoice({ id: "d", choices: [dice] }, "go", ctx(), createRng("r")).cause).toBe("chance");
  });
  it("evaluates effects that depend on the person", () => {
    const c = choice({
      outcomes: [{ p: 1, text: "a", effects: ({ person }) => [{ stat: "skills", add: person.age }] }],
    });
    expect(resolveChoice({ id: "d", choices: [c] }, "go", ctx(), createRng("r")).effects).toEqual([
      { stat: "skills", add: 10 },
    ]);
  });
  it("draws exactly one number, whichever choice is taken", () => {
    const a = createRng("one");
    const b = createRng("one");
    resolveChoice(
      { id: "d", choices: [choice({ id: "x" }), choice({ id: "y", outcomes: [{ p: 1, text: "o", effects: [] }] })] },
      "x",
      ctx(),
      a,
    );
    b.next();
    expect(a.next()).toBe(b.next());
  });
});

describe("the default choice", () => {
  it("is the one marked default, else the first that can be taken", () => {
    const locked = choice({ id: "first", locks: [{ when: () => true, reason: "lock.no" }] });
    expect(defaultChoiceId({ id: "d", choices: [locked, choice({ id: "second" })] }, ctx())).toBe("second");
    expect(
      defaultChoiceId({ id: "d", choices: [choice({ id: "a" }), choice({ id: "b", default: true })] }, ctx()),
    ).toBe("b");
  });
  it("fails loudly when nothing can be taken", () => {
    const locked = choice({ locks: [{ when: () => true, reason: "lock.no" }] });
    expect(() => defaultChoiceId({ id: "d", choices: [locked] }, ctx())).toThrow(/no choice/);
  });
});
