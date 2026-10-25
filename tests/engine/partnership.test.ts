import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADULT_AGE,
  NEVER_MARRY,
  birthChance,
  fertilityScale,
  marriageAge,
  shareMarriedBy,
  stepFertility,
  stepPartnership,
  waitOdds,
  weddingAge,
  MEET_DECISION,
  YOUNG_MARRIAGE_DECISION,
} from "../../src/engine/partnership";
import { applyEffectsToPerson } from "../../src/engine/effects";
import { createRng } from "../../src/engine/rng";
import { stageForAge } from "../../src/engine/stages";
import type { Person, Relationship, Sex } from "../../src/engine/types";
import type { Country } from "../../src/engine/world/types";
import { en } from "../../src/content/strings/en";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const real = (iso3: string) => JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;
const country = makeCountry({ region: "Western Africa" });
const at = (age: number, overrides: Partial<Person> = {}) => makePerson({ age, stage: stageForAge(age), ...overrides });
const partner = (overrides: Partial<Relationship> = {}): Relationship => ({
  id: "partner",
  kind: "partner",
  name: "Sam",
  sex: "male",
  age: 28,
  alive: true,
  closeness: 70,
  ...overrides,
});

describe("age at first marriage (REL-004)", () => {
  const sample = (c: Country, sex: Sex, n = 4000) => {
    const ages: number[] = [];
    for (let i = 0; i < n; i++) {
      const age = marriageAge((i + 0.5) / n, sex, c);
      if (age !== null) ages.push(age);
    }
    return ages;
  };
  it.each(["JPN", "NGA", "IND", "BRA", "USA", "NER"])(
    "%s: the mean age of those who marry is the published one",
    (iso3) => {
      const c = real(iso3);
      for (const sex of ["female", "male"] as const) {
        const ages = sample(c, sex);
        const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
        expect(Math.abs(mean - c.family.meanAgeFirstMarriage.value[sex]), `${iso3} ${sex}`).toBeLessThan(1);
      }
    },
  );
  it.each(["JPN", "NGA", "IND", "BRA", "USA"])(
    "%s: the share of women married before 18 is the published one",
    (iso3) => {
      const c = real(iso3);
      const ages = sample(c, "female");
      const under = ages.filter((a) => a < ADULT_AGE - 0.5).length / 4000;
      expect(Math.abs(under - c.family.childMarriageBy18.value)).toBeLessThan(0.03);
    },
  );
  it("leaves a small share who never marry, and nobody marries before twelve or after sixty", () => {
    const never = Array.from({ length: 1000 }, (_, i) => marriageAge(i / 1000, "male", country)).filter(
      (a) => a === null,
    );
    expect(never.length / 1000).toBeCloseTo(NEVER_MARRY, 1);
    for (const a of sample(country, "female")) {
      expect(a).toBeGreaterThan(12);
      expect(a).toBeLessThanOrEqual(60);
    }
  });
  it("rises with the draw, so the same person always marries at the same age", () => {
    let last = 0;
    for (let i = 0; i < 100; i++) {
      const age = marriageAge(i / 110, "female", country)!;
      expect(age).toBeGreaterThanOrEqual(last);
      last = age;
    }
  });
  it("agrees with the share married by an age", () => {
    const ages = sample(country, "female");
    for (const age of [18, 22, 26, 35]) {
      const share = ages.filter((a) => a <= age).length / 4000;
      expect(shareMarriedBy(age, "female", country)).toBeCloseTo(share, 1);
    }
    expect(shareMarriedBy(12, "female", country)).toBe(0);
  });
  it("is nudged by nature and by Belonging, and put off by a partner turned away", () => {
    const base = at(20, { marriageDraw: 0.5 });
    const wed = weddingAge(base, country)!;
    expect(weddingAge({ ...base, traits: { ...base.traits, sociability: 2 } }, country)!).toBeLessThan(wed);
    expect(weddingAge({ ...base, traits: { ...base.traits, sociability: -2 } }, country)!).toBeGreaterThan(wed);
    expect(weddingAge({ ...base, focus: { belonging: 1 } }, country)!).toBeLessThanOrEqual(wed);
    expect(weddingAge({ ...base, flags: { marriageDelay: 2 } }, country)!).toBe(wed + 2);
    expect(weddingAge(at(20, { marriageDraw: 0.99 }), country)).toBeNull();
  });
  it("does not bring an arranged marriage forward, and never moves an adult wedding below 18", () => {
    const young = at(10, { marriageDraw: 0.01, traits: { ...makePerson().traits, sociability: 2 } });
    const plain = at(10, { marriageDraw: 0.01 });
    expect(weddingAge(young, country)).toBe(weddingAge(plain, country));
    const early = at(10, {
      marriageDraw: 0.3,
      traits: { ...makePerson().traits, sociability: 2 },
      focus: { belonging: 3 },
    });
    expect(weddingAge(early, country)!).toBeGreaterThanOrEqual(ADULT_AGE);
  });
});

describe("courtship and marriage (REL-003)", () => {
  const adult = (age: number, overrides: Partial<Person> = {}) => at(age, { marriageDraw: 0.5, ...overrides });
  const wed = weddingAge(adult(20), country)!;

  it("draws four numbers whatever happens", () => {
    for (const person of [adult(10), adult(wed - 1), adult(wed, { relationships: [partner()] })]) {
      const rng = createRng("draw");
      const control = createRng("draw");
      stepPartnership(person, country, rng, { open: true });
      for (let i = 0; i < 4; i++) control.next();
      expect(rng.next()).toBe(control.next());
    }
  });
  it("gives each possible partner an id of their own, so one who died before the wedding does not block the next", () => {
    const earlier = stepPartnership(adult(wed - 1), country, createRng("meet"), { open: true }).events[0]!.ask!.payload!
      .relative as Relationship;
    const later = stepPartnership(
      adult(wed, { relationships: [{ ...earlier, alive: false }] }),
      country,
      createRng("meet"),
      {
        open: true,
      },
    ).events[0]!.ask!.payload!.relative as Relationship;
    expect(later.id).not.toBe(earlier.id);
    // The dead one is still on the list, and the new one is added all the same.
    const person = adult(wed, { relationships: [{ ...earlier, alive: false }] });
    const added = applyEffectsToPerson(person, [{ relationship: "add", relative: later }], "choice", country).person;
    expect(added.relationships.filter((r) => r.kind === "partner")).toHaveLength(2);
  });
  it("offers a chance to meet someone a year before the wedding age, when the year has room", () => {
    const step = stepPartnership(adult(wed - 1), country, createRng("meet"), { open: true });
    expect(step.events).toHaveLength(1);
    const [event] = step.events;
    expect(event!.ask?.eventId).toBe(MEET_DECISION);
    expect(event!.ask?.payload?.relative).toMatchObject({ kind: "partner", sex: "male", alive: true });
    expect(event!.vars?.partner).toBe(event!.ask?.payload?.relative?.name);
  });
  it("waits when the year has no room, and does not offer before its time", () => {
    expect(stepPartnership(adult(wed - 1), country, createRng("meet"), { open: false }).events).toEqual([]);
    expect(stepPartnership(adult(wed - 3), country, createRng("meet"), { open: true }).events).toEqual([]);
    expect(stepPartnership(adult(10), country, createRng("meet"), { open: true }).events).toEqual([]);
  });
  it("brings a partner of the other sex, near the age the country's marriages suggest", () => {
    const ages: number[] = [];
    for (let i = 0; i < 200; i++) {
      const [event] = stepPartnership(adult(wed - 1, { sex: "female" }), country, createRng(`p${i}`), {
        open: true,
      }).events;
      const found = event!.ask!.payload!.relative!;
      expect(found.sex).toBe("male");
      ages.push(found.age);
    }
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    // Fixture: men marry at 27 and women at 23, so a woman's partner is about four years older.
    expect(mean).toBeGreaterThan(wed - 1 + 2.5);
    expect(mean).toBeLessThan(wed - 1 + 5.5);
  });
  it("turns a partner into a spouse at the wedding age", () => {
    const [event] = stepPartnership(adult(wed, { relationships: [partner()] }), country, createRng("wed"), {
      open: false,
    }).events;
    expect(event!.id).toBe("rel.marriage");
    expect(event!.effects).toContainEqual({ become: "spouse", id: "partner" });
    expect(event!.effects).toContainEqual({ set: "marriedAt", value: wed });
    expect(
      stepPartnership(adult(wed - 1, { relationships: [partner()] }), country, createRng("wed"), { open: true }).events,
    ).toEqual([]);
  });
  it("does nothing for someone already married, or who never will", () => {
    expect(
      stepPartnership(adult(wed, { flags: { married: true } }), country, createRng("m"), { open: true }).events,
    ).toEqual([]);
    expect(stepPartnership(adult(40, { marriageDraw: 0.99 }), country, createRng("m"), { open: true }).events).toEqual(
      [],
    );
    const spouse = partner({ kind: "spouse" });
    expect(
      stepPartnership(adult(wed, { relationships: [spouse] }), country, createRng("m"), { open: true }).events,
    ).toEqual([]);
  });
  it("arranges a marriage under 18 as a decision about waiting, or carries it out when there is no room (REL-004)", () => {
    const girl = at(15, { marriageDraw: 0.01, sex: "female" });
    const age = weddingAge(girl, country)!;
    expect(age).toBeLessThan(ADULT_AGE);
    const asked = stepPartnership({ ...girl, age }, country, createRng("y"), { open: true }).events[0]!;
    expect(asked).toMatchObject({ sensitivity: "difficult", helpTopic: "abuse" });
    expect(asked.ask?.eventId).toBe(YOUNG_MARRIAGE_DECISION);
    expect(asked.ask?.payload?.relative?.kind).toBe("spouse");
    const arranged = stepPartnership({ ...girl, age }, country, createRng("y"), { open: false }).events[0]!;
    expect(arranged.id).toBe("rel.young_marriage_arranged");
    expect(arranged.effects).toContainEqual({ set: "marriedAt", value: age });
    // Both are difficult, so both have a shorter telling for softening.
    for (const event of [asked, arranged]) {
      expect(event.softTextKey, event.id).toBeDefined();
      expect(en[event.softTextKey!], event.id).toBeDefined();
    }
  });
  it("makes asking to wait likelier for the better off, the abler and a girl still at school, within bounds", () => {
    const girl = at(15, { sex: "female" });
    const rich = { ...girl, money: { ...girl.money, householdPercentile: 95 } };
    const poor = { ...girl, money: { ...girl.money, householdPercentile: 5 } };
    expect(waitOdds(rich)).toBeGreaterThan(waitOdds(poor));
    expect(waitOdds({ ...girl, education: { ...girl.education, inSchool: true } })).toBeGreaterThan(waitOdds(girl));
    expect(waitOdds({ ...girl, traits: { ...girl.traits, aptitude: 2 } })).toBeGreaterThan(waitOdds(girl));
    for (const p of [rich, poor]) {
      expect(waitOdds(p)).toBeGreaterThanOrEqual(0.05);
      expect(waitOdds(p)).toBeLessThanOrEqual(0.75);
    }
  });
});

describe("children (FAM-004)", () => {
  const mother = (age: number, overrides: Partial<Person> = {}) =>
    at(age, { sex: "female", relationships: [partner({ kind: "spouse" })], ...overrides });

  it("draws four numbers whatever happens", () => {
    for (const person of [mother(28), at(28), mother(60)]) {
      const rng = createRng("f");
      const control = createRng("f");
      stepFertility(person, country, rng);
      for (let i = 0; i < 4; i++) control.next();
      expect(rng.next()).toBe(control.next());
    }
  });
  it("peaks around the country's mean age at birth and is zero outside the fertile years", () => {
    const mean = country.demography.meanAgeAtBirth.value;
    expect(birthChance(mean, country)).toBeGreaterThan(birthChance(mean - 8, country));
    expect(birthChance(mean, country)).toBeGreaterThan(birthChance(mean + 8, country));
    expect(birthChance(14, country)).toBe(0);
    expect(birthChance(45, country)).toBe(0);
    for (let age = 15; age <= 44; age++) expect(birthChance(age, country)).toBeLessThanOrEqual(0.6);
  });
  it("is scaled so that a woman who lives through the fertile years has the country's fertility", () => {
    for (const iso3 of ["JPN", "NGA", "NER", "USA"]) {
      const c = real(iso3);
      let expected = 0;
      for (let age = 15; age <= 44; age++) expected += shareMarriedBy(age + 1, "female", c) * birthChance(age, c);
      expect(expected / c.demography.tfr.value, iso3).toBeGreaterThan(0.85);
      expect(expected / c.demography.tfr.value, iso3).toBeLessThan(1.05);
    }
    expect(fertilityScale(country)).toBeGreaterThan(0);
  });
  it("gives a child to a partnered woman, or to the partner of a partnered man, and to no one alone", () => {
    const born = (person: Person) => {
      let n = 0;
      for (let i = 0; i < 300; i++) if (stepFertility(person, country, createRng(`b${i}`)).events.length > 0) n++;
      return n;
    };
    expect(born(mother(country.demography.meanAgeAtBirth.value))).toBeGreaterThan(30);
    const father = at(30, {
      sex: "male",
      relationships: [
        partner({ sex: "female", age: Math.round(country.demography.meanAgeAtBirth.value), kind: "spouse" }),
      ],
    });
    expect(born(father)).toBeGreaterThan(30);
    expect(born(at(28, { sex: "female" }))).toBe(0);
    expect(born(mother(28, { relationships: [partner({ alive: false })] }))).toBe(0);
    const tooOld = at(30, { sex: "male", relationships: [partner({ sex: "female", age: 52, kind: "spouse" })] });
    expect(born(tooOld)).toBe(0);
  });
  it("adds a living newborn, glad news, and records who it is", () => {
    for (let i = 0; i < 300; i++) {
      const [event] = stepFertility(mother(28), country, createRng(`n${i}`)).events;
      if (!event) continue;
      expect(event.id).toBe("family.child_born");
      const add = event.effects.find((e) => "relationship" in e && e.relationship === "add");
      expect(add).toMatchObject({ relative: { kind: "child", age: 0, alive: true, id: "child-28" } });
      expect(event.effects).toContainEqual({ stat: "happiness", add: 4 });
      return;
    }
    throw new Error("no child was born in 300 tries");
  });
});
