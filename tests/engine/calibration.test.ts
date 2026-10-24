import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LE_TOLERANCE_YEARS, calibrateLifeExpectancy, expectedLifeExpectancy, simulateLife } from "../../src/engine/calibration";
import type { Country } from "../../src/engine/world/types";
import { makeCountry } from "../fixtures/country";

const load = (iso3: string) => JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;

describe("calibration harness (SIM-007)", () => {
  it("simulates a whole life headless", () => {
    const life = simulateLife("harness", makeCountry({ region: "Western Africa" }));
    expect(life.person.alive).toBe(false);
    expect(life.death).toBeDefined();
  });
  it("computes the expected life expectancy at birth from both sexes' tables", () => {
    const c = makeCountry();
    const e = expectedLifeExpectancy(c);
    expect(e).toBeGreaterThan(40);
    expect(e).toBeLessThan(100);
  });
  it("reports the gap between simulated and source life expectancy", () => {
    const report = calibrateLifeExpectancy(makeCountry({ region: "Western Africa" }), 300, "gap");
    expect(report.lives).toBe(300);
    expect(report.difference).toBeCloseTo(report.simulated - report.expected, 10);
  });

  // The calibration gate: simulated life expectancy must be within 2 years of the UN WPP value.
  const sample = ["NGA", "IND", "BRA", "JPN", "ETH", "USA"];
  it.each(sample)("%s is within the tolerance of its life table", (iso3) => {
    expect(LE_TOLERANCE_YEARS).toBe(2);
    const report = calibrateLifeExpectancy(load(iso3), 2000, `calibrate-${iso3}`);
    expect(Math.abs(report.difference), `${iso3}: expected ${report.expected.toFixed(1)}, simulated ${report.simulated.toFixed(1)}`).toBeLessThanOrEqual(LE_TOLERANCE_YEARS);
  }, 60_000);

  it("fails loudly when mortality is mis-calibrated", () => {
    const real = load("JPN");
    const wrong = {
      ...real,
      demography: { ...real.demography, lifeTable: { ...real.demography.lifeTable, value: { female: real.demography.lifeTable.value.female.map((q, i) => (i === 100 ? q : q * 4)), male: real.demography.lifeTable.value.male } } },
    };
    // Same simulated life, but compared against the true table: the gap must exceed the tolerance.
    const report = calibrateLifeExpectancy(wrong, 800, "wrong");
    const against = expectedLifeExpectancy(real);
    expect(Math.abs(report.simulated - against)).toBeGreaterThan(LE_TOLERANCE_YEARS);
  });
});
