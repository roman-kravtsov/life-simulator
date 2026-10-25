import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { attainmentShares, literacyChance } from "../../src/engine/education";
import { createRng } from "../../src/engine/rng";
import { stageForAge } from "../../src/engine/stages";
import type { EducationLevel, Person, Sector } from "../../src/engine/types";
import {
  FINDING_RATE,
  findingChance,
  jobLossChance,
  jobHealthPenalty,
  informalOdds,
  participationRate,
  sectorOdds,
  stepWork,
  workStatusFor,
} from "../../src/engine/work";
import type { Country } from "../../src/engine/world/types";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

const country = makeCountry();
const real = (iso3: string) => JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;
const at = (age: number, overrides: Partial<Person> = {}) => makePerson({ age, stage: stageForAge(age), ...overrides });
const worker = (age: number, attachment: number, overrides: Partial<Person> = {}) =>
  at(age, { work: { status: "child", yearsWorked: 0, attachment }, ...overrides });

describe("participation by age (CAREER-001)", () => {
  const rate = (age: number, c = country, sex: "female" | "male" = "male") => participationRate(sex, age, c);
  it("rises through the late teens, holds through the prime years and falls in old age", () => {
    expect(rate(15)).toBeLessThan(rate(20));
    expect(rate(20)).toBeLessThan(rate(27));
    expect(rate(35)).toBeCloseTo(rate(45), 6);
    expect(rate(60)).toBeLessThan(rate(50));
    expect(rate(75)).toBeLessThan(rate(60));
    expect(rate(95)).toBeLessThan(0.1);
  });
  it("stays a probability at every age", () => {
    for (let age = 15; age <= 100; age++) {
      expect(rate(age)).toBeGreaterThanOrEqual(0);
      expect(rate(age)).toBeLessThanOrEqual(1);
    }
  });
  it("is higher for the sex the country reports more participation for", () => {
    expect(rate(35, country, "male")).toBeGreaterThan(rate(35, country, "female"));
  });
  it("keeps working longer where most work is informal", () => {
    const informal = makeCountry({
      work: { ...country.work, informalShare: { ...country.work.informalShare, value: 0.95 } },
    });
    const formal = makeCountry({
      work: { ...country.work, informalShare: { ...country.work.informalShare, value: 0.1 } },
    });
    const drop = (c: Country) => rate(70, c) / rate(45, c);
    expect(drop(informal)).toBeGreaterThan(drop(formal));
  });
});

describe("work status", () => {
  const status = (age: number, attachment: number, overrides: Partial<Person> = {}) =>
    workStatusFor(worker(age, attachment, overrides), country);
  it("is child before six and student in school", () => {
    expect(status(4, 0)).toBe("child");
    expect(status(9, 0, { education: { level: "none", inSchool: true, years: 3 } })).toBe("student");
    expect(status(19, 0, { education: { level: "upper-secondary", inSchool: true, years: 12 } })).toBe("student");
  });
  it("is child for a school-age child who is not in school", () => {
    expect(status(10, 0)).toBe("child");
  });
  it("is employed or informal at working age when the person's attachment is under the participation rate", () => {
    const formal = { sector: "services" as Sector, formal: true, yearsWorked: 3, attachment: 0.01 };
    expect(workStatusFor(worker(30, 0.01, { work: { status: "child", ...formal } }), country)).toBe("employed");
    expect(workStatusFor(worker(30, 0.01, { work: { status: "child", ...formal, formal: false } }), country)).toBe(
      "informal",
    );
  });
  it("is caregiver for an adult out of the labour force, and retired once old", () => {
    expect(status(35, 0.999)).toBe("caregiver");
    expect(status(70, 0.999)).toBe("retired");
  });
  it("is retired from 55 for someone who has worked, caregiver for someone who has not", () => {
    expect(
      workStatusFor(worker(58, 0.999, { work: { status: "employed", yearsWorked: 30, attachment: 0.999 } }), country),
    ).toBe("retired");
    expect(status(58, 0.999)).toBe("caregiver");
  });
  it("is child for a teenager at home who is not in school or at work", () => {
    expect(status(16, 0.999)).toBe("child");
  });
  it("takes a person with failing health out of work", () => {
    const sick = worker(50, 0.01, {
      stats: { health: 10, happiness: 50, belonging: 50, skills: 30 },
      work: { status: "employed", sector: "services", formal: true, yearsWorked: 20, attachment: 0.01 },
    });
    expect(workStatusFor(sick, country)).toBe("caregiver");
  });
});

describe("stepWork", () => {
  const prime = (overrides: Partial<Person> = {}) => worker(25, 0.01, overrides);
  const step = (person: Person, seed = "w") => stepWork(person, country, createRng(seed));

  it("draws exactly three numbers whatever the person is doing", () => {
    for (const [age, attachment] of [
      [3, 0.5],
      [30, 0.01],
      [30, 0.99],
      [70, 0.5],
    ] as const) {
      const rng = createRng(`two-${age}`);
      const control = createRng(`two-${age}`);
      stepWork(worker(age, attachment), country, rng);
      control.next();
      control.next();
      control.next();
      expect(rng.next()).toBe(control.next());
    }
  });
  it("gives a first job with a sector and a formal or informal status, and records it once", () => {
    const first = step(prime());
    expect(first.person.work.sector).toBeDefined();
    expect(typeof first.person.work.formal).toBe("boolean");
    expect(["employed", "informal"]).toContain(first.person.work.status);
    expect(first.person.work.yearsWorked).toBe(1);
    expect(first.events.map((e) => e.id)).toEqual(["work.starts"]);
    expect(first.events[0]!.textKey).toMatch(
      /^event\.work\.starts\.(agriculture|industry|services)\.(formal|informal)$/,
    );
    const second = stepWork({ ...first.person, age: 26 }, country, createRng("again"));
    expect(second.person.work.sector).toBe(first.person.work.sector);
    expect(second.person.work.formal).toBe(first.person.work.formal);
    expect(second.person.work.yearsWorked).toBe(2);
    expect(second.events).toEqual([]);
  });
  it("does not start a job for a student or a child", () => {
    const pupil = step(prime({ education: { level: "upper-secondary", inSchool: true, years: 12 } }));
    expect(pupil.person.work.sector).toBeUndefined();
    expect(pupil.person.work.status).toBe("student");
    expect(step(worker(10, 0.01)).person.work.sector).toBeUndefined();
  });
  it("retires someone who stops working in old age and says so", () => {
    const old = worker(66, 0.7, {
      work: { status: "employed", sector: "services", formal: true, yearsWorked: 40, attachment: 0.7 },
    });
    const result = stepWork(old, country, createRng("ret"));
    expect(result.person.work.status).toBe("retired");
    expect(result.events.map((e) => e.id)).toEqual(["work.retires"]);
  });
  it("notes when a worker leaves work to look after home and family", () => {
    const parent = worker(30, 0.99, {
      work: { status: "informal", sector: "agriculture", formal: false, yearsWorked: 4, attachment: 0.99 },
    });
    const result = stepWork(parent, country, createRng("home"));
    expect(result.person.work.status).toBe("caregiver");
    expect(result.events.map((e) => e.id)).toEqual(["work.stops"]);
  });
  it("is pure", () => {
    const person = prime();
    const copy = structuredClone(person);
    step(person);
    expect(person).toEqual(copy);
  });
});

describe("sector and informality (CAREER-002, WORLD-009)", () => {
  const sectors = ["agriculture", "industry", "services"] as const;
  const person = (level: EducationLevel, location: "rural" | "urban") =>
    at(30, { education: { level, inSchool: false, years: 8 }, location });
  const odds = (level: EducationLevel, location: "rural" | "urban") => sectorOdds(person(level, location), country);

  it("gives odds that add up to one", () => {
    for (const level of ["none", "primary", "tertiary"] as const) {
      expect(sectors.reduce((sum, s) => sum + odds(level, "rural")[s], 0)).toBeCloseTo(1, 9);
    }
  });
  it("puts rural people in agriculture more and in services less than town people", () => {
    expect(odds("primary", "rural").agriculture).toBeGreaterThan(odds("primary", "urban").agriculture);
    expect(odds("primary", "rural").services).toBeLessThan(odds("primary", "urban").services);
  });
  it("puts people with more schooling in services more and in agriculture less", () => {
    expect(odds("tertiary", "urban").services).toBeGreaterThan(odds("none", "urban").services);
    expect(odds("tertiary", "urban").agriculture).toBeLessThan(odds("none", "urban").agriculture);
  });
  it("hits the country's sector shares on average over its people", () => {
    const c = real("IND");
    for (const sex of ["female", "male"] as const) {
      const shares = attainmentShares(c, sex);
      const urban = c.demography.urbanShare.value;
      const mean = { agriculture: 0, industry: 0, services: 0 };
      for (const level of Object.keys(shares) as EducationLevel[]) {
        for (const location of ["rural", "urban"] as const) {
          const weight = shares[level] * (location === "urban" ? urban : 1 - urban);
          const o = sectorOdds(at(30, { sex, education: { level, inSchool: false, years: 6 }, location }), c);
          for (const s of sectors) mean[s] += weight * o[s];
        }
      }
      for (const s of sectors) expect(mean[s]).toBeCloseTo(c.work.sectorShares.value[s], 3);
    }
  });
  it("makes informal work likelier in agriculture, in the countryside and with less schooling", () => {
    const base = person("primary", "urban");
    expect(informalOdds(base, "agriculture", country)).toBeGreaterThan(informalOdds(base, "services", country));
    expect(informalOdds(person("primary", "rural"), "industry", country)).toBeGreaterThan(
      informalOdds(person("primary", "urban"), "industry", country),
    );
    expect(informalOdds(person("none", "urban"), "industry", country)).toBeGreaterThan(
      informalOdds(person("tertiary", "urban"), "industry", country),
    );
  });
  it("makes informal work likelier for someone who cannot read (EDU-002)", () => {
    const reader = at(30, { education: { level: "primary", inSchool: false, years: 6, literate: true } });
    const nonReader = at(30, { education: { level: "primary", inSchool: false, years: 6, literate: false } });
    for (const sector of sectors)
      expect(informalOdds(nonReader, sector, country)).toBeGreaterThan(informalOdds(reader, sector, country));
  });
  it("hits the country's informal share on average over its workers", () => {
    const c = real("NGA");
    const sex = "female";
    const shares = attainmentShares(c, sex);
    const urban = c.demography.urbanShare.value;
    let informal = 0;
    for (const level of Object.keys(shares) as EducationLevel[]) {
      for (const location of ["rural", "urban"] as const) {
        const person = (literate: boolean) =>
          at(30, { sex, education: { level, inSchool: false, years: 6, literate }, location });
        const o = sectorOdds(person(true), c);
        const weight = shares[level] * (location === "urban" ? urban : 1 - urban);
        const reads = literacyChance(sex, c, level !== "none");
        for (const s of sectors) {
          informal +=
            weight *
            o[s] *
            (reads * informalOdds(person(true), s, c) + (1 - reads) * informalOdds(person(false), s, c));
        }
      }
    }
    expect(informal).toBeCloseTo(c.work.informalShare.value, 3);
  });
  it("costs health in dangerous and informal jobs, and nothing without a job (WORLD-009)", () => {
    const job = (sector: Sector, formal: boolean) =>
      at(30, { work: { status: formal ? "employed" : "informal", sector, formal, yearsWorked: 5, attachment: 0.1 } });
    expect(jobHealthPenalty(job("services", true))).toBe(0);
    expect(jobHealthPenalty(job("industry", true))).toBeGreaterThan(0);
    expect(jobHealthPenalty(job("agriculture", true))).toBeGreaterThan(0);
    expect(jobHealthPenalty(job("services", false))).toBeGreaterThan(jobHealthPenalty(job("services", true)));
    expect(jobHealthPenalty(at(30))).toBe(0);
    expect(
      jobHealthPenalty(
        at(70, { work: { status: "retired", sector: "industry", formal: true, yearsWorked: 40, attachment: 0.1 } }),
      ),
    ).toBe(0);
  });
});

describe("unemployment spells (CAREER-003)", () => {
  const employed = (overrides: Partial<Person> = {}) =>
    at(35, {
      work: { status: "employed", sector: "services", formal: true, yearsWorked: 10, attachment: 0.01 },
      ...overrides,
    });
  const jobless = () =>
    employed({ work: { status: "unemployed", sector: "services", formal: true, yearsWorked: 10, attachment: 0.01 } });

  it("holds the loss and finding rates to the country's unemployment (loss x 1 / (loss + finding))", () => {
    for (const u of [0.02, 0.06, 0.15, 0.33]) {
      const c = makeCountry({ work: { ...country.work, unemployment: { ...country.work.unemployment, value: u } } });
      const loss = jobLossChance(employed(), c);
      expect(loss / (loss + FINDING_RATE)).toBeCloseTo(u, 6);
    }
  });
  it("lets a worker lose the job and an unemployed person find one, each with its own event", () => {
    const hard = makeCountry({ work: { ...country.work, unemployment: { ...country.work.unemployment, value: 0.5 } } });
    let lost = 0;
    let found = 0;
    for (let i = 0; i < 400; i++) {
      const out = stepWork(employed(), hard, createRng(`lose${i}`));
      if (out.person.work.status === "unemployed") {
        lost++;
        expect(out.events.map((e) => e.id)).toEqual(["work.job_lost"]);
        expect(out.person.work.yearsWorked).toBe(10);
      }
      const back = stepWork(jobless(), hard, createRng(`find${i}`));
      if (back.person.work.status !== "unemployed") {
        found++;
        expect(back.events.map((e) => e.id)).toEqual(["work.job_found"]);
        expect(back.person.work.yearsWorked).toBe(11);
      }
    }
    expect(lost).toBeGreaterThan(0);
    expect(found / 400).toBeGreaterThan(0.35);
    expect(found / 400).toBeLessThan(0.55);
  });
  it("makes unemployment cost happiness when it begins and give it back when work returns", () => {
    const hard = makeCountry({ work: { ...country.work, unemployment: { ...country.work.unemployment, value: 0.5 } } });
    for (let i = 0; i < 400; i++) {
      const out = stepWork(employed(), hard, createRng(`h${i}`));
      if (out.events[0]?.id === "work.job_lost") {
        expect(out.events[0].effects).toEqual([{ stat: "happiness", add: -3 }]);
        return;
      }
    }
    throw new Error("no job was lost in 400 tries");
  });
  it("takes the job search into account: points on Earn find work sooner and keep it longer", () => {
    const searching = jobless();
    const keen = { ...searching, focus: { earn: 1 } };
    const idle = { ...searching, focus: { earn: -1 } };
    expect(findingChance(keen)).toBeGreaterThan(findingChance(searching));
    expect(findingChance(idle)).toBeLessThan(findingChance(searching));
    expect(jobLossChance({ ...employed(), focus: { earn: 1 } }, country)).toBeLessThan(
      jobLossChance(employed(), country),
    );
  });
  it("leaves the unemployed out of work when they leave the labour force", () => {
    const old = employed({
      age: 70,
      work: { status: "unemployed", sector: "services", formal: true, yearsWorked: 30, attachment: 0.99 },
    });
    const out = stepWork(old, country, createRng("old"));
    expect(out.person.work.status).toBe("retired");
    expect(out.events.map((e) => e.id)).toEqual(["work.retires"]);
  });
  it("starts a first-time entrant out of work at the country's rate", () => {
    const hard = makeCountry({ work: { ...country.work, unemployment: { ...country.work.unemployment, value: 0.3 } } });
    let out = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      const entrant = worker(25, 0.01);
      if (stepWork(entrant, hard, createRng(`e${i}`)).person.work.status === "unemployed") out++;
    }
    expect(out / n).toBeGreaterThan(0.25);
    expect(out / n).toBeLessThan(0.35);
  });

  // The batch: people in the labour force from 30 to 45, stepped year by year, are out of work at the country's rate.
  it.each([
    ["JPN", 0.03],
    ["NGA", 0.03],
    ["ZAF", 0.03],
  ])("%s: the share of the labour force out of work matches the source within %f", (iso3, tolerance) => {
    const c = real(iso3);
    const target = c.work.unemployment.value;
    let jobless = 0;
    let force = 0;
    for (let i = 0; i < 1500; i++) {
      let p = worker(30, 0, { sex: "male", work: { status: "child", yearsWorked: 0, attachment: 0.0001 } });
      const rng = createRng(`batch-${iso3}-${i}`);
      for (let age = 30; age <= 45; age++) {
        p = { ...p, age, stage: stageForAge(age) };
        p = stepWork(p, c, rng).person;
        if (age >= 38) {
          if (p.work.status === "unemployed") jobless++;
          if (p.work.status === "unemployed" || p.work.status === "employed" || p.work.status === "informal") force++;
        }
      }
    }
    expect(Math.abs(jobless / force - target)).toBeLessThan(tolerance);
  });
});
