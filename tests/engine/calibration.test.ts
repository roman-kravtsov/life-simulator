import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LE_TOLERANCE_YEARS,
  calibrateLifeExpectancy,
  calibrateSystems,
  expectedLifeExpectancy,
  simulateLife,
} from "../../src/engine/calibration";
import { advance, newLife } from "../../src/engine/life";
import { hazardMultiplier } from "../../src/engine/mortality";
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
  it.each(sample)(
    "%s is within the tolerance of its life table",
    (iso3) => {
      expect(LE_TOLERANCE_YEARS).toBe(2);
      const report = calibrateLifeExpectancy(load(iso3), 2000, `calibrate-${iso3}`);
      expect(
        Math.abs(report.difference),
        `${iso3}: expected ${report.expected.toFixed(1)}, simulated ${report.simulated.toFixed(1)}`,
      ).toBeLessThanOrEqual(LE_TOLERANCE_YEARS);
    },
    60_000,
  );

  it("fails loudly when mortality is mis-calibrated", () => {
    const real = load("JPN");
    const wrong = {
      ...real,
      demography: {
        ...real.demography,
        lifeTable: {
          ...real.demography.lifeTable,
          value: {
            female: real.demography.lifeTable.value.female.map((q, i) => (i === 100 ? q : q * 4)),
            male: real.demography.lifeTable.value.male,
          },
        },
      },
    };
    // Same simulated life, but compared against the true table: the gap must exceed the tolerance.
    const report = calibrateLifeExpectancy(wrong, 800, "wrong");
    const against = expectedLifeExpectancy(real);
    expect(Math.abs(report.simulated - against)).toBeGreaterThan(LE_TOLERANCE_YEARS);
  });
});

describe("the life systems against the source data (M4)", () => {
  // EDU-001, EDU-002, CAREER-001, CAREER-002, MONEY-003, FAM-002: whole lives, compared with each
  // country's published completion, literacy, participation, sector, informality, fertility and
  // schooling persistence. Each comparison has its own tolerance, set in calibrateSystems.
  const countries = ["NGA", "NER", "IND", "BRA", "JPN", "USA"];
  it.each(countries)(
    "%s: school, work, income and family reproduce the source within tolerance",
    (iso3) => {
      const comparisons = calibrateSystems(load(iso3), 1500, `systems-${iso3}`);
      expect(comparisons.length).toBeGreaterThan(15);
      for (const c of comparisons) {
        expect(
          Math.abs(c.simulated - c.expected),
          `${iso3}: ${c.name}: expected ${c.expected.toFixed(3)}, simulated ${c.simulated.toFixed(3)}`,
        ).toBeLessThanOrEqual(c.tolerance);
      }
    },
    90_000,
  );

  it("reports every comparison as a finite number", () => {
    const comparisons = calibrateSystems(makeCountry({ region: "Western Africa" }), 100, "finite");
    for (const c of comparisons) {
      expect(Number.isFinite(c.expected), c.name).toBe(true);
      expect(Number.isFinite(c.simulated), c.name).toBe(true);
    }
  });

  // HEALTH-004: conditions decide who dies at an age, not how many, so the average hazard multiplier
  // among the living stays near 1 at every age.
  it.each(["JPN", "NGA"])(
    "%s: conditions leave the average hazard multiplier near 1 at every age",
    (iso3) => {
      const country = load(iso3);
      const byDecade = new Map<number, { n: number; total: number }>();
      for (let i = 0; i < 500; i++) {
        let state = newLife({ seed: `hazard-${iso3}-${i}`, country });
        while (state.person.alive) {
          const decade = Math.floor(state.person.age / 10);
          const cell = byDecade.get(decade) ?? { n: 0, total: 0 };
          byDecade.set(decade, { n: cell.n + 1, total: cell.total + hazardMultiplier(state.person, country) });
          state = advance(state, { kind: "continue" }, country).state;
        }
      }
      for (const [decade, { n, total }] of byDecade) {
        if (n < 500) continue;
        expect(total / n, `${iso3} age ${decade * 10}s`).toBeGreaterThan(0.85);
        expect(total / n, `${iso3} age ${decade * 10}s`).toBeLessThan(1.15);
      }
    },
    60_000,
  );
});
