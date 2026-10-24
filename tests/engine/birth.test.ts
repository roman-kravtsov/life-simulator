import { describe, expect, it } from "vitest";
import { generatePerson } from "../../src/engine/person";
import { dailyIncome, householdBand, drawHouseholdPercentile } from "../../src/engine/money";
import { generateParents } from "../../src/engine/family";
import { createRng, stream } from "../../src/engine/rng";
import { TRAIT_IDS } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";
import { namesForRegion } from "../../src/content/names";

const country = makeCountry({ region: "Western Africa" });
const people = (n: number, c = country) => Array.from({ length: n }, (_, i) => generatePerson(`seed-${i}`, c));

describe("generatePerson (CHAR-001)", () => {
  it("is deterministic for the same seed and country", () => {
    expect(generatePerson("abc", country)).toEqual(generatePerson("abc", country));
  });
  it("fills every field of a newborn", () => {
    const p = generatePerson("abc", country);
    expect(p.age).toBe(0);
    expect(p.stage).toBe("infancy");
    expect(p.alive).toBe(true);
    expect(p.countryIso3).toBe("AAA");
    expect(p.birthYear).toBe(country.demography.lifeTable.year);
    expect(["female", "male"]).toContain(p.sex);
    expect(["rural", "urban"]).toContain(p.location);
    expect(p.name.length).toBeGreaterThan(1);
    expect(p.conditions).toEqual([]);
  });
  it("draws sex from the country's sex ratio at birth", () => {
    const males = people(6000).filter((p) => p.sex === "male").length;
    // 1.05 males per female is 51.2% male.
    expect(males / 6000).toBeGreaterThan(0.49);
    expect(males / 6000).toBeLessThan(0.535);
  });
  it("names the person from the region's list for their sex", () => {
    const list = namesForRegion("Western Africa");
    for (const p of people(50)) expect(list[p.sex]).toContain(p.name);
  });
  it("starts with a mother and a father who are alive, with names from the region", () => {
    const p = generatePerson("abc", country);
    const kinds = p.relationships.map((r) => r.kind);
    expect(kinds).toEqual(["mother", "father"]);
  });
});

describe("location (WORLD-009)", () => {
  it("follows the country's urban share", () => {
    const urban = (share: number) =>
      people(
        4000,
        makeCountry({
          region: "Western Africa",
          demography: { ...country.demography, urbanShare: { ...country.demography.urbanShare, value: share } },
        }),
      ).filter((p) => p.location === "urban").length / 4000;
    expect(urban(0.2)).toBeGreaterThan(0.17);
    expect(urban(0.2)).toBeLessThan(0.23);
    expect(urban(0.9)).toBeGreaterThan(0.87);
    expect(urban(0.9)).toBeLessThan(0.93);
  });
});

describe("traits (CHAR-003)", () => {
  it("rolls all six traits between -2 and 2, centred on 0", () => {
    const ps = people(3000);
    for (const id of TRAIT_IDS) {
      const values = ps.map((p) => p.traits[id]);
      expect(Math.min(...values)).toBe(-2);
      expect(Math.max(...values)).toBe(2);
      expect(values.every(Number.isInteger)).toBe(true);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(Math.abs(mean)).toBeLessThan(0.1);
    }
  });
});

describe("household at birth (MONEY-001)", () => {
  it("draws percentiles uniformly from 1 to 100", () => {
    const rng = createRng("household");
    const counts = new Array<number>(10).fill(0);
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const p = drawHouseholdPercentile(rng);
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(100);
      counts[Math.floor((p - 1) / 10)]!++;
    }
    for (const c of counts) expect(c / n).toBeGreaterThan(0.09);
    for (const c of counts) expect(c / n).toBeLessThan(0.11);
  });
  it("reads daily income per person from the percentile table", () => {
    expect(dailyIncome(country, 1)).toBe(country.money.percentiles.value[0]);
    expect(dailyIncome(country, 100)).toBe(country.money.percentiles.value[99]);
    expect(dailyIncome(country, 50)).toBe(country.money.percentiles.value[49]);
  });
  it("describes the household in bands of ten percent", () => {
    expect(householdBand(1)).toBe(1);
    expect(householdBand(10)).toBe(1);
    expect(householdBand(11)).toBe(2);
    expect(householdBand(100)).toBe(10);
  });
  it("puts the newborn's household percentile on the person", () => {
    const p = generatePerson("abc", country);
    expect(p.money.householdPercentile).toBeGreaterThanOrEqual(1);
    expect(p.money.householdPercentile).toBeLessThanOrEqual(100);
    expect(p.money.savings).toBe(0);
    expect(p.money.debt).toBe(0);
  });
});

describe("parents (FAM-001)", () => {
  const parents = (n: number) =>
    Array.from({ length: n }, (_, i) => generateParents(createRng(`p${i}`), country, createRng(`n${i}`)));
  it("makes a mother and a father, alive at the birth", () => {
    for (const [mother, father] of parents(50)) {
      expect(mother!.kind).toBe("mother");
      expect(mother!.sex).toBe("female");
      expect(father!.kind).toBe("father");
      expect(father!.sex).toBe("male");
      expect(mother!.alive && father!.alive).toBe(true);
      expect(mother!.closeness).toBeGreaterThanOrEqual(40);
      expect(mother!.closeness).toBeLessThanOrEqual(100);
    }
  });
  it("centres the mother's age on the country's mean age at birth", () => {
    const ages = parents(3000).map(([m]) => m!.age);
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    expect(mean).toBeGreaterThan(27.5);
    expect(mean).toBeLessThan(28.5);
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(16);
    expect(Math.max(...ages)).toBeLessThanOrEqual(46);
  });
  it("makes the father a few years older on average", () => {
    const gaps = parents(3000).map(([m, f]) => f!.age - m!.age);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeGreaterThan(2);
    expect(mean).toBeLessThan(4.5);
    expect(Math.min(...parents(3000).map(([, f]) => f!.age))).toBeGreaterThanOrEqual(17);
  });
});

describe("parents' random stream", () => {
  it("is separate from the year-0 family stream, so a parent's age says nothing about their year-0 death roll", () => {
    const n = 3000;
    const spread: number[] = [];
    const rolls: number[] = [];
    for (let i = 0; i < n; i++) {
      const seed = `corr-${i}`;
      const mother = generatePerson(seed, country).relationships[0]!;
      spread.push(Math.abs(mother.age - country.demography.meanAgeAtBirth.value));
      rolls.push(stream(seed, "family", 0).next());
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const [ms, mr] = [mean(spread), mean(rolls)];
    let cov = 0;
    let vs = 0;
    let vr = 0;
    for (let i = 0; i < n; i++) {
      cov += (spread[i]! - ms) * (rolls[i]! - mr);
      vs += (spread[i]! - ms) ** 2;
      vr += (rolls[i]! - mr) ** 2;
    }
    expect(Math.abs(cov / Math.sqrt(vs * vr))).toBeLessThan(0.08);
  });
});
