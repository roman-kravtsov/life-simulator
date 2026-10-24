import { describe, expect, it } from "vitest";
import { attainmentShares } from "../../src/engine/education";
import {
  INDEPENDENCE_AGE,
  adultPercentile,
  dailyIncome,
  debtStress,
  educationScore,
  stepMoney,
  yearlyIncome,
} from "../../src/engine/money";
import { createRng } from "../../src/engine/rng";
import { stageForAge } from "../../src/engine/stages";
import type { EducationLevel, Person } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";
import { makePerson, moneyAt } from "../fixtures/person";

const country = makeCountry();
const LEVELS: EducationLevel[] = ["none", "primary", "lower-secondary", "upper-secondary", "tertiary"];
const adult = (overrides: Partial<Person> = {}) =>
  makePerson({
    age: 35,
    stage: stageForAge(35),
    education: { level: "primary", inSchool: false, years: 6 },
    work: { status: "employed", sector: "services", formal: true, yearsWorked: 10, attachment: 0.1 },
    stats: { health: 70, happiness: 60, belonging: 60, skills: 45 },
    ...overrides,
  });

describe("education score (MONEY-003)", () => {
  it("rises with the level of schooling", () => {
    const scores = LEVELS.map((level) =>
      educationScore(adult({ education: { level, inSchool: false, years: 8 } }), country),
    );
    for (let i = 1; i < scores.length; i++) expect(scores[i]!).toBeGreaterThan(scores[i - 1]!);
  });
  it("has mean 0 and spread near 1 over the country's people", () => {
    const shares = attainmentShares(country, "female");
    let mean = 0;
    let second = 0;
    for (const level of LEVELS) {
      const z = educationScore(adult({ sex: "female", education: { level, inSchool: false, years: 8 } }), country);
      mean += shares[level] * z;
      second += shares[level] * z * z;
    }
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.sqrt(second - mean * mean)).toBeGreaterThan(0.85);
    expect(Math.sqrt(second - mean * mean)).toBeLessThan(1.05);
  });
});

describe("adult percentile (MONEY-003)", () => {
  const pct = (overrides: Partial<Person> = {}, c = country) => adultPercentile(adult(overrides), c);
  it("is a whole percentile from 1 to 100", () => {
    for (const luck of [-4, 0, 4])
      for (const h of [1, 50, 100]) {
        const p = pct({ money: moneyAt(h, { luck }) });
        expect(Number.isInteger(p)).toBe(true);
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(100);
      }
  });
  it("rises with household, education, skills and luck", () => {
    expect(pct({ money: moneyAt(90) })).toBeGreaterThan(pct({ money: moneyAt(10) }));
    expect(pct({ education: { level: "tertiary", inSchool: false, years: 16 } })).toBeGreaterThan(
      pct({ education: { level: "none", inSchool: false, years: 1 } }),
    );
    expect(pct({ stats: { health: 70, happiness: 60, belonging: 60, skills: 90 } })).toBeGreaterThan(
      pct({ stats: { health: 70, happiness: 60, belonging: 60, skills: 10 } }),
    );
    expect(pct({ money: moneyAt(50, { luck: 2 }) })).toBeGreaterThan(pct({ money: moneyAt(50, { luck: -2 }) }));
  });
  it("is lower in informal work than formal, and in agriculture than services", () => {
    const job = (sector: "agriculture" | "services", formal: boolean) =>
      pct({ work: { status: formal ? "employed" : "informal", sector, formal, yearsWorked: 10, attachment: 0.1 } });
    expect(job("services", false)).toBeLessThan(job("services", true));
    expect(job("agriculture", true)).toBeLessThan(job("services", true));
  });
  it("follows the household more where the country's persistence is higher", () => {
    const withPersistence = (value: number) =>
      makeCountry({
        money: {
          ...country.money,
          intergenerationalPersistence: { ...country.money.intergenerationalPersistence, value },
        },
      });
    const gap = (c: ReturnType<typeof withPersistence>) =>
      pct({ money: moneyAt(95) }, c) - pct({ money: moneyAt(5) }, c);
    expect(gap(withPersistence(0.8))).toBeGreaterThan(gap(withPersistence(0.1)));
  });
  it("ignores the household where persistence is zero", () => {
    const none = makeCountry({
      money: {
        ...country.money,
        intergenerationalPersistence: { ...country.money.intergenerationalPersistence, value: 0 },
      },
    });
    expect(pct({ money: moneyAt(95) }, none)).toBe(pct({ money: moneyAt(5) }, none));
  });
});

describe("income (MONEY-002)", () => {
  it("reads the country's table at the person's percentile, per year, for a worker", () => {
    for (const percentile of [1, 17, 50, 83, 100]) {
      const person = adult({ money: moneyAt(percentile) });
      expect(yearlyIncome(person, country)).toBeCloseTo(dailyIncome(country, percentile) * 365, 6);
    }
  });
  it("pays a retired person less than a worker at the same percentile", () => {
    const retired = adult({ work: { status: "retired", yearsWorked: 40, attachment: 0.1 } });
    expect(yearlyIncome(retired, country)).toBeLessThan(yearlyIncome(adult(), country));
    expect(yearlyIncome(retired, country)).toBeGreaterThan(0);
  });
  it("pays a caregiver or an unemployed adult less than a worker, from household support rather than a job", () => {
    for (const status of ["caregiver", "unemployed"] as const) {
      const out = adult({ work: { status, yearsWorked: 5, attachment: 0.9 } });
      expect(yearlyIncome(out, country)).toBeLessThan(yearlyIncome(adult(), country));
      expect(yearlyIncome(out, country)).toBeGreaterThan(0);
    }
  });
  it("is the household's share for a child or student, not the person's own", () => {
    const child = makePerson({ age: 8, money: moneyAt(30, { percentile: 30 }) });
    expect(yearlyIncome(child, country)).toBeCloseTo(dailyIncome(country, 30) * 365, 6);
  });
});

describe("stepMoney (MONEY-003, MONEY-004)", () => {
  const step = (person: Person, seed = "m") => stepMoney(person, country, createRng(seed));
  it("draws exactly two numbers whatever the person's age", () => {
    for (const age of [3, 17, 35, 80]) {
      const rng = createRng(`two-${age}`);
      const control = createRng(`two-${age}`);
      stepMoney(adult({ age }), country, rng);
      control.next();
      control.next();
      expect(rng.next()).toBe(control.next());
    }
  });
  it("leaves a child's or student's money alone, at the household's standing", () => {
    const child = makePerson({ age: 8, money: moneyAt(30, { percentile: 80 }) });
    const { person } = step(child);
    expect(person.money).toMatchObject({ percentile: 30, savings: 0, debt: 0 });
    const student = adult({
      age: 20,
      education: { level: "upper-secondary", inSchool: true, years: 12 },
      money: moneyAt(30),
    });
    expect(step(student).person.money).toMatchObject({ percentile: 30, savings: 0, debt: 0 });
  });
  it("sets the adult percentile from the mix once independent", () => {
    const person = adult({ age: INDEPENDENCE_AGE, money: moneyAt(30, { percentile: 30, luck: 1.5 }) });
    expect(step(person).person.money.percentile).toBe(adultPercentile(person, country));
  });
  it("saves for the well-off over the years", () => {
    let person = adult({ money: moneyAt(95) });
    for (let year = 0; year < 20; year++)
      person = stepMoney({ ...person, age: 35 + year }, country, createRng(`rich-${year}`)).person;
    expect(person.money.savings).toBeGreaterThan(0);
    expect(person.money.debt).toBe(0);
  });
  it("runs into debt for the poorest, and debt cannot be negative nor savings", () => {
    let person = adult({
      money: moneyAt(1),
      education: { level: "none", inSchool: false, years: 0 },
      stats: { health: 70, happiness: 60, belonging: 60, skills: 5 },
    });
    for (let year = 0; year < 30; year++) {
      person = stepMoney({ ...person, age: 35 + year }, country, createRng(`poor-${year}`)).person;
      expect(person.money.savings).toBeGreaterThanOrEqual(0);
      expect(person.money.debt).toBeGreaterThanOrEqual(0);
    }
    expect(person.money.debt).toBeGreaterThan(0);
  });
  it("pays a shortfall from savings before it borrows, and pays debt before it saves", () => {
    const poor = adult({ money: moneyAt(1, { savings: 1_000_000 }) });
    const drawn = step(poor, "short").person.money;
    expect(drawn.debt).toBe(0);
    const indebted = adult({ money: moneyAt(99, { debt: 50 }) });
    const repaid = step(indebted, "repay").person.money;
    expect(repaid.debt).toBe(0);
    expect(repaid.savings).toBeGreaterThan(0);
  });
  it("charges interest on debt", () => {
    const person = adult({ money: moneyAt(1, { debt: 10_000 }) });
    expect(step(person).person.money.debt).toBeGreaterThan(10_000);
  });
  it("records when debt becomes a weight and when it is cleared", () => {
    const heavy = adult({ money: moneyAt(1, { debt: 5_000 }) });
    const first = step(heavy);
    expect(first.person.flags.debtPressure).toBe(true);
    expect(first.events.map((e) => e.id)).toContain("money.debt_pressure");
    const again = stepMoney(first.person, country, createRng("again"));
    expect(again.events.map((e) => e.id)).not.toContain("money.debt_pressure");
    const cleared = stepMoney(
      { ...again.person, money: moneyAt(99, { luck: 3, debt: 1 }), flags: { debtPressure: true } },
      country,
      createRng("rich"),
    );
    expect(cleared.events.map((e) => e.id)).toContain("money.debt_cleared");
    expect(cleared.person.flags.debtPressure).toBe(false);
  });
});

describe("debt stress (MONEY-004)", () => {
  it("is zero without debt and grows with debt against income, up to 1", () => {
    const stress = (debt: number) => debtStress(adult({ money: moneyAt(20, { debt }) }), country);
    expect(stress(0)).toBe(0);
    expect(stress(100)).toBeGreaterThan(0);
    expect(stress(2000)).toBeGreaterThan(stress(100));
    expect(stress(1e9)).toBe(1);
  });
  it("weighs more on someone who lives on less than a worker's income", () => {
    const debt = 500;
    const worker = debtStress(adult({ money: moneyAt(20, { debt }) }), country);
    const unemployed = debtStress(
      adult({ money: moneyAt(20, { debt }), work: { status: "unemployed", yearsWorked: 5, attachment: 0.9 } }),
      country,
    );
    expect(unemployed).toBeGreaterThan(worker);
  });
  it("is zero for a child", () => {
    expect(debtStress(makePerson({ age: 9, money: moneyAt(5, { debt: 1e6 }) }), country)).toBe(0);
  });
});
