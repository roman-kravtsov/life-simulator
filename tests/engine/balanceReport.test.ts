// The balance report (ADMIN-003) as Markdown: a summary, a section for each country, and a flag on every
// figure further from the source than its tolerance.
import { describe, expect, it } from "vitest";
import type { Comparison } from "../../src/engine/calibration";
import { isOutside, renderBalanceReport, type CountryBalance } from "../../src/engine/balanceReport";

const comparison = (name: string, expected: number, simulated: number, tolerance: number): Comparison => ({
  name,
  expected,
  simulated,
  tolerance,
});

const country = (iso3: string, difference: number, comparisons: Comparison[]): CountryBalance => ({
  country: { iso3, name: `Country ${iso3}`, region: "Nowhere", incomeGroup: "upper-middle" },
  lifeExpectancy: { lives: 100, expected: 70, simulated: 70 + difference, difference },
  comparisons,
});

describe("isOutside", () => {
  it("is true only past the tolerance", () => {
    expect(isOutside(comparison("a", 0.5, 0.56, 0.07))).toBe(false);
    expect(isOutside(comparison("a", 0.5, 0.58, 0.07))).toBe(true);
    expect(isOutside(comparison("a", 0.5, 0.42, 0.07))).toBe(true);
  });
});

describe("renderBalanceReport", () => {
  const report = renderBalanceReport({
    countries: [
      country("AAA", 0.4, [
        comparison("female primary completion", 0.9, 0.92, 0.07),
        comparison("female mean age at first marriage", 22, 20.5, 2),
        comparison("deaths from cancer", 0.2, 0.3, 0.05),
      ]),
      country("BBB", 3, []),
    ],
    lives: 100,
    contentVersion: "2026.10.3",
    dataVersion: "2026.10.1",
  });

  it("names the versions and the number of lives", () => {
    expect(report).toContain("Content version 2026.10.3, data version 2026.10.1");
    expect(report).toContain("100 default-course lives");
  });
  it("gives a summary line for each country with how many figures are outside", () => {
    expect(report).toContain("| Country AAA (AAA) | upper-middle | 70.0 | 70.4 | 1 of 4 |");
    expect(report).toContain("| Country BBB (BBB) | upper-middle | 70.0 | 73.0 | 1 of 1 |");
  });
  it("flags what is outside, and shows shares as percentages and years as numbers", () => {
    expect(report).toContain("| deaths from cancer | 20.0% | 30.0% | 5.0% | **outside** |");
    expect(report).toContain("| female primary completion | 90.0% | 92.0% | 7.0% | ok |");
    expect(report).toContain("| female mean age at first marriage | 22.00 | 20.50 | 2.00 | ok |");
    expect(report).toContain("| life expectancy at birth (years) | 70.0 | 73.0 | 2 | **outside** |");
  });
});
