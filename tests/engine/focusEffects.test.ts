// What each focus area does to the numbers it is meant to move (DEC-003). Units are points above or
// below the default plan, so the tests compare a person with the same person at the default.
import { describe, expect, it } from "vitest";
import { happinessNorm, healthNorm, skillGrowth } from "../../src/engine/drift";
import { leavingFactor } from "../../src/engine/education";
import { stepMoney } from "../../src/engine/money";
import { closenessNorm } from "../../src/engine/relationships";
import { createRng } from "../../src/engine/rng";
import { stageForAge } from "../../src/engine/stages";
import type { FocusArea, Person, Relationship } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";
import { makePerson, moneyAt } from "../fixtures/person";

const country = makeCountry();
const at = (age: number, area: FocusArea, units: number, overrides: Partial<Person> = {}) =>
  makePerson({ age, stage: stageForAge(age), focus: { [area]: units }, ...overrides });
const friend: Relationship = {
  id: "f",
  kind: "friend",
  name: "Ife",
  sex: "female",
  age: 30,
  alive: true,
  closeness: 50,
};
const sister: Relationship = { ...friend, id: "s", kind: "sibling" };

describe("Learn", () => {
  it("raises the yearly skill gain with a point more, and lowers it with a point less", () => {
    const gain = (units: number) =>
      skillGrowth(at(12, "learn", units, { education: { ...makePerson().education, inSchool: true } }));
    expect(gain(1)).toBeGreaterThan(gain(0));
    expect(gain(-1)).toBeLessThan(gain(0));
  });
  it("keeps a child in school: leaving runs slower with more Learn, faster with less", () => {
    const factor = (units: number) => leavingFactor(at(13, "learn", units), country);
    expect(factor(1)).toBeLessThan(factor(0));
    expect(factor(-1)).toBeGreaterThan(factor(0));
  });
});

describe("Earn", () => {
  it("saves more of an adult's income with a point more, and spends more with a point less", () => {
    const worth = (units: number) => {
      const { savings, debt } = stepMoney(at(35, "earn", units, { money: moneyAt(50) }), country, createRng("earn"))
        .person.money;
      return savings - debt;
    };
    expect(worth(1)).toBeGreaterThan(worth(0));
    expect(worth(-1)).toBeLessThan(worth(0));
  });
});

describe("Earn at work", () => {
  const job = (status: "employed" | "informal" | "unemployed"): Partial<Person> => ({
    work: { ...makePerson().work, status, sector: "services", formal: status === "employed" },
  });
  const gain = (units: number, overrides: Partial<Person>) => skillGrowth(at(30, "earn", units, overrides));

  it("adds to what a working adult picks up on the job, and takes from it with a point less", () => {
    for (const status of ["employed", "informal"] as const) {
      expect(gain(1, job(status))).toBeGreaterThan(gain(0, job(status)));
      expect(gain(-1, job(status))).toBeLessThan(gain(0, job(status)));
    }
  });
  it("does nothing for someone out of work, at school, or a child", () => {
    expect(gain(1, job("unemployed"))).toBe(gain(0, job("unemployed")));
    const student = { ...job("employed"), education: { ...makePerson().education, inSchool: true } };
    expect(gain(1, student)).toBe(gain(0, student));
    expect(skillGrowth(at(16, "earn", 1, job("employed")))).toBe(skillGrowth(at(16, "earn", 0, job("employed"))));
  });
  it("is worth more than a point on Learn does for an adult, since work is where an adult learns", () => {
    const learnGain =
      skillGrowth(at(30, "learn", 1, job("employed"))) - skillGrowth(at(30, "learn", 0, job("employed")));
    expect(gain(1, job("employed")) - gain(0, job("employed"))).toBeGreaterThan(learnGain);
  });
});

describe("Health", () => {
  it("lifts the health a person settles at with a point more, and lowers it with a point less", () => {
    const norm = (units: number) => healthNorm(at(40, "health", units), country);
    expect(norm(1)).toBeGreaterThan(norm(0));
    expect(norm(-1)).toBeLessThan(norm(0));
  });
});

describe("Rest", () => {
  it("lifts the happiness a person settles at with a point more, and lowers it with a point less", () => {
    const norm = (units: number) => happinessNorm(at(40, "rest", units), country);
    expect(norm(1)).toBeGreaterThan(norm(0));
    expect(norm(-1)).toBeLessThan(norm(0));
  });
});

describe("Belonging", () => {
  it("keeps family close with a point more, and lets them drift with a point less", () => {
    const norm = (units: number) => closenessNorm(sister, at(30, "belonging", units));
    expect(norm(1)).toBeGreaterThan(norm(0));
    expect(norm(-1)).toBeLessThan(norm(0));
  });
  it("lets a friend nobody makes time for drift much further away than a relative (REL-002)", () => {
    const person = at(30, "belonging", -1);
    expect(closenessNorm(friend, person)).toBeLessThan(closenessNorm(sister, person) - 20);
    expect(closenessNorm(friend, at(30, "belonging", 0))).toBeGreaterThan(closenessNorm(friend, person) + 20);
  });
});
