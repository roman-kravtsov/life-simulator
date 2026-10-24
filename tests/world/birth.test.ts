import { describe, expect, it } from "vitest";
import { createRng, stream } from "../../src/engine/rng";
import { drawBirthCountry } from "../../src/engine/world/birth";
import type { CountryIndex } from "../../src/engine/world/types";

// SYNTHETIC index for tests only.
const index: CountryIndex = {
  dataVersion: "test",
  sources: {},
  excluded: [],
  countries: [
    { iso3: "AAA", iso2: "XX", name: "A", region: "R", incomeGroup: "low", birthsPerYear: 600, population: 1_000 },
    { iso3: "BBB", iso2: "XX", name: "B", region: "R", incomeGroup: "high", birthsPerYear: 300, population: 50_000 },
    { iso3: "CCC", iso2: "XX", name: "C", region: "R", incomeGroup: "high", birthsPerYear: 100, population: 9_000 },
  ],
};

describe("drawBirthCountry", () => {
  it("draws countries in proportion to their births, within half a percentage point", () => {
    const rng = createRng("births");
    const counts: Record<string, number> = { AAA: 0, BBB: 0, CCC: 0 };
    const n = 100_000;
    for (let i = 0; i < n; i++) counts[drawBirthCountry(index, rng).iso3]!++;
    expect(Math.abs(counts.AAA! / n - 0.6)).toBeLessThan(0.005);
    expect(Math.abs(counts.BBB! / n - 0.3)).toBeLessThan(0.005);
    expect(Math.abs(counts.CCC! / n - 0.1)).toBeLessThan(0.005);
  });

  it("is deterministic for a seed", () => {
    const a = drawBirthCountry(index, stream("seed-1", "birth", 0));
    const b = drawBirthCountry(index, stream("seed-1", "birth", 0));
    expect(a).toBe(b);
  });

  it("refuses an index with no countries", () => {
    expect(() => drawBirthCountry({ ...index, countries: [] }, createRng("x"))).toThrow();
  });
});
