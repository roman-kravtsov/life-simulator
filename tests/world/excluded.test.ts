import { describe, expect, it } from "vitest";
import { excludedBirths } from "../../src/engine/world/excluded";
import type { CountryIndex } from "../../src/engine/world/types";

// SYNTHETIC index for tests only.
const index: CountryIndex = {
  dataVersion: "test",
  birthsYear: 2023,
  sources: {},
  countries: [
    { iso3: "AAA", iso2: "XX", name: "A", region: "R", incomeGroup: "low", birthsPerYear: 900, population: 1_000 },
  ],
  excluded: [
    { iso3: "BBB", iso2: "XX", name: "B", missing: ["health.causeMix"], birthsPerYear: 60 },
    { iso3: "CCC", iso2: "XX", name: "C", missing: ["incomeGroup"], birthsPerYear: 40 },
    { iso3: "DDD", iso2: "XX", name: "D", missing: ["demography.birthsPerYear"] },
  ],
};

describe("WORLD-014: births in the countries left out", () => {
  it("counts the births of the left-out countries against all births, in the year of the figures", () => {
    expect(excludedBirths(index)).toMatchObject({ excluded: 100, total: 1000, share: 0.1, year: 2023 });
  });

  it("lists the largest left-out countries first and skips those with no births figure", () => {
    expect(excludedBirths(index, 2).largest.map((c) => c.iso3)).toEqual(["BBB", "CCC"]);
    expect(excludedBirths(index, 5).largest.map((c) => c.iso3)).toEqual(["BBB", "CCC"]);
  });

  it("is zero when nothing is left out", () => {
    expect(excludedBirths({ ...index, excluded: [] })).toMatchObject({ excluded: 0, share: 0, largest: [] });
  });
});
