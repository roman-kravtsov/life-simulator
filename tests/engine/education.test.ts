import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEVELS,
  attainmentShares,
  continuationProbability,
  inSchoolShare,
  levelAtAge,
  literacyChance,
  stepEducation,
} from "../../src/engine/education";
import { createRng } from "../../src/engine/rng";
import { stageForAge } from "../../src/engine/stages";
import type { Country } from "../../src/engine/world/types";
import type { Person } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";
import { makePerson, moneyAt } from "../fixtures/person";

const country = makeCountry();
const at = (age: number, overrides: Partial<Person> = {}) => makePerson({ age, stage: stageForAge(age), ...overrides });
const real = (iso3: string) => JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;

describe("school levels (EDU-001)", () => {
  it("runs primary at 6 to 11, lower secondary at 12 to 14, upper secondary at 15 to 17 and tertiary at 18 to 21", () => {
    expect(levelAtAge(5)).toBeUndefined();
    expect(levelAtAge(6)?.id).toBe("primary");
    expect(levelAtAge(11)?.id).toBe("primary");
    expect(levelAtAge(12)?.id).toBe("lower-secondary");
    expect(levelAtAge(14)?.id).toBe("lower-secondary");
    expect(levelAtAge(15)?.id).toBe("upper-secondary");
    expect(levelAtAge(17)?.id).toBe("upper-secondary");
    expect(levelAtAge(18)?.id).toBe("tertiary");
    expect(levelAtAge(21)?.id).toBe("tertiary");
    expect(levelAtAge(22)).toBeUndefined();
    expect(LEVELS.map((l) => l.id)).toEqual(["primary", "lower-secondary", "upper-secondary", "tertiary"]);
  });
});

describe("continuation odds (EDU-001, WORLD-009)", () => {
  const p = (person: Person, level = "primary" as const) => continuationProbability(person, country, level);
  it("is a probability for every kind of person", () => {
    for (const percentile of [1, 50, 100]) {
      for (const location of ["rural", "urban"] as const) {
        const value = p(at(8, { location, money: moneyAt(percentile) }));
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
  it("is lower for a poor household than a rich one", () => {
    expect(p(at(8, { money: moneyAt(5) }))).toBeLessThan(p(at(8, { money: moneyAt(95) })));
  });
  it("is lower in the countryside than in town", () => {
    expect(p(at(8, { location: "rural" }))).toBeLessThan(p(at(8, { location: "urban" })));
  });
  it("is higher with more aptitude", () => {
    const apt = (value: number) =>
      p(at(8, { traits: { temperament: 0, curiosity: 0, resilience: 0, sociability: 0, aptitude: value, constitution: 0 } }));
    expect(apt(2)).toBeGreaterThan(apt(-2));
  });
  it("uses the household's start, not the person's later standing", () => {
    expect(p(at(8, { money: moneyAt(5, { percentile: 90 }) }))).toBe(p(at(8, { money: moneyAt(5) })));
  });
  it("follows the country's rates: a country that rarely finishes primary loses children faster", () => {
    const low = makeCountry({
      education: {
        ...country.education,
        primaryCompletion: { ...country.education.primaryCompletion, value: { female: 0.3, male: 0.3 } },
      },
    });
    expect(continuationProbability(at(8), low, "primary")).toBeLessThan(p(at(8)));
  });
  it("is certain where everyone finishes", () => {
    const full = makeCountry({
      education: {
        ...country.education,
        primaryCompletion: { ...country.education.primaryCompletion, value: { female: 1, male: 1 } },
      },
    });
    expect(continuationProbability(at(8), full, "primary")).toBe(1);
  });
  it("is zero where nobody finishes", () => {
    const none = makeCountry({
      education: {
        ...country.education,
        primaryCompletion: { ...country.education.primaryCompletion, value: { female: 0, male: 0 } },
      },
    });
    expect(continuationProbability(at(8), none, "primary")).toBe(0);
  });
});

describe("stepEducation", () => {
  const step = (person: Person, seed = "e", c = country) => stepEducation(person, c, createRng(seed));

  it("starts school at six", () => {
    const { person, events } = step(at(6));
    expect(events.map((e) => e.id)).toContain("school.starts");
    expect(person.education.years).toBeGreaterThanOrEqual(0);
    expect(step(at(5)).person.education.inSchool).toBe(false);
    expect(step(at(5)).events).toEqual([]);
  });
  it("draws exactly two numbers whatever the age and state", () => {
    for (const age of [0, 6, 9, 12, 17, 21, 40]) {
      const rng = createRng(`count-${age}`);
      const control = createRng(`count-${age}`);
      stepEducation(at(age), country, rng);
      control.next();
      control.next();
      expect(rng.next()).toBe(control.next());
    }
  });
  it("lets a child drop out: they leave school, keep the level they had and it is recorded", () => {
    let found = false;
    for (let i = 0; i < 400 && !found; i++) {
      const { person, events } = step(at(9, { education: { level: "none", inSchool: true, years: 3 } }), `drop-${i}`);
      if (!person.education.inSchool) {
        found = true;
        expect(person.education.level).toBe("none");
        expect(person.education.years).toBe(4);
        const left = events.find((e) => e.id === "school.left")!;
        expect(left.textKey).toBe("event.school.left.primary");
        expect(left.cause).toBe("circumstance");
      }
    }
    expect(found).toBe(true);
  });
  it("completes a level at its last year and carries on to the next", () => {
    const full = makeCountry({
      education: Object.fromEntries(
        Object.entries(country.education).map(([k, v]) => [k, { ...v, value: { female: 1, male: 1 } }]),
      ) as Country["education"],
    });
    const { person, events } = stepEducation(
      at(11, { education: { level: "none", inSchool: true, years: 5 } }),
      full,
      createRng("done"),
    );
    expect(person.education).toMatchObject({ level: "primary", inSchool: true, years: 6 });
    expect(events.find((e) => e.id === "school.completed")?.textKey).toBe("event.school.completed.primary");
  });
  it("stops school after the last tertiary year", () => {
    const full = makeCountry({
      education: Object.fromEntries(
        Object.entries(country.education).map(([k, v]) => [k, { ...v, value: { female: 1, male: 1 } }]),
      ) as Country["education"],
    });
    const { person } = stepEducation(
      at(21, { education: { level: "upper-secondary", inSchool: true, years: 15 } }),
      full,
      createRng("end"),
    );
    expect(person.education).toMatchObject({ level: "tertiary", inSchool: false });
  });
  it("never puts an adult back in school", () => {
    expect(step(at(30)).person.education.inSchool).toBe(false);
  });
  it("is pure: the input is not changed", () => {
    const person = at(9, { education: { level: "none", inSchool: true, years: 3 } });
    const copy = structuredClone(person);
    step(person);
    expect(person).toEqual(copy);
  });
});

describe("literacy (EDU-002)", () => {
  it("is not set before the primary years end and is set at 12", () => {
    expect(stepEducation(at(11), country, createRng("l")).person.education.literate).toBeUndefined();
    expect(stepEducation(at(12), country, createRng("l")).person.education.literate).toBeTypeOf("boolean");
  });
  it("is far likelier after primary school than without it", () => {
    expect(literacyChance("female", country, true)).toBeGreaterThan(literacyChance("female", country, false));
  });
  it("adds up to the country's adult rate for each sex", () => {
    for (const sex of ["female", "male"] as const) {
      const completers = country.education.primaryCompletion.value[sex];
      const rate = completers * literacyChance(sex, country, true) + (1 - completers) * literacyChance(sex, country, false);
      expect(rate).toBeCloseTo(country.education.literacy.value[sex], 6);
    }
  });
  it("stays a probability where the data is inconsistent (more literate than finished primary, and the reverse)", () => {
    const odd = makeCountry({
      education: {
        ...country.education,
        primaryCompletion: { ...country.education.primaryCompletion, value: { female: 0.9, male: 0.2 } },
        literacy: { ...country.education.literacy, value: { female: 0.3, male: 0.99 } },
      },
    });
    for (const sex of ["female", "male"] as const) {
      for (const done of [true, false]) {
        const chance = literacyChance(sex, odd, done);
        expect(chance).toBeGreaterThanOrEqual(0);
        expect(chance).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("the schooling model", () => {
  it("shares of each level of attainment add up to one and match the completion rates", () => {
    const shares = attainmentShares(country, "female");
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(1 - shares.none).toBeCloseTo(0.9, 2);
    expect(shares["upper-secondary"] + shares.tertiary).toBeCloseTo(0.5, 2);
    expect(shares.tertiary).toBeCloseTo(0.2 * 0.7, 2);
  });
  it("keeps everyone in school at six and nobody before it or after 21", () => {
    expect(inSchoolShare(country, "male", 5)).toBe(0);
    expect(inSchoolShare(country, "male", 6)).toBe(1);
    expect(inSchoolShare(country, "male", 22)).toBe(0);
    expect(inSchoolShare(country, "male", 12)).toBeLessThan(inSchoolShare(country, "male", 7));
  });
});

describe("the schooling batch reproduces each country's completion rates (EDU-001)", () => {
  // Whole cohorts through school with the real data. Tertiary uses enrolment, so it is checked
  // as the enrolment rate times the assumed completion share (see TERTIARY_COMPLETION).
  const cohort = (c: Country, sex: "female" | "male", n: number) => {
    const reached = { primary: 0, lower: 0, upper: 0 };
    for (let i = 0; i < n; i++) {
      let person = makePerson({
        sex,
        age: 0,
        location: i % 100 < c.demography.urbanShare.value * 100 ? "urban" : "rural",
        money: moneyAt(1 + (i % 100)),
        traits: {
          temperament: 0,
          curiosity: 0,
          resilience: 0,
          sociability: 0,
          aptitude: ([-2, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2] as const)[Math.floor(i / 100) % 16]!,
          constitution: 0,
        },
      });
      for (let age = 6; age <= 21; age++) {
        person = stepEducation({ ...person, age }, c, createRng(`cohort-${sex}-${i}-${age}`)).person;
      }
      const rank = ["none", "primary", "lower-secondary", "upper-secondary", "tertiary"].indexOf(person.education.level);
      if (rank >= 1) reached.primary++;
      if (rank >= 2) reached.lower++;
      if (rank >= 3) reached.upper++;
    }
    return { primary: reached.primary / n, lower: reached.lower / n, upper: reached.upper / n };
  };
  it.each(["NGA", "NER", "JPN", "IND", "USA"])("%s", (iso3) => {
    const c = real(iso3);
    for (const sex of ["female", "male"] as const) {
      const got = cohort(c, sex, 1600);
      const cap = (x: number) => Math.min(1, x);
      const primary = cap(c.education.primaryCompletion.value[sex]);
      const lower = Math.min(primary, cap(c.education.lowerSecondaryCompletion.value[sex]));
      const upper = Math.min(lower, cap(c.education.upperSecondaryCompletion.value[sex]));
      expect(Math.abs(got.primary - primary), `${iso3} ${sex} primary`).toBeLessThan(0.05);
      expect(Math.abs(got.lower - lower), `${iso3} ${sex} lower secondary`).toBeLessThan(0.05);
      expect(Math.abs(got.upper - upper), `${iso3} ${sex} upper secondary`).toBeLessThan(0.05);
    }
  }, 30_000);
});
