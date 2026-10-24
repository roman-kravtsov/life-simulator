import { describe, expect, it } from "vitest";
import { assemble, type RawCountry } from "../../scripts/data/assemble";
import { validateCountry } from "../../src/engine/world/validate";
import { makeCountry, testSources } from "../fixtures/country";

/** Turns a fixture country into the pipeline's raw form, optionally dropping indicators. */
function raw(overrides: Parameters<typeof makeCountry>[0] = {}, drop: string[] = []): RawCountry {
  const c = makeCountry(overrides);
  const indicators: RawCountry["indicators"] = {};
  for (const group of ["demography", "money", "education", "work", "family", "health"] as const) {
    for (const [key, value] of Object.entries(c[group])) {
      const path = `${group}.${key}`;
      if (!drop.includes(path)) (indicators as Record<string, unknown>)[path] = value;
    }
  }
  return { iso3: c.iso3, iso2: c.iso2, name: c.name, region: c.region, incomeGroup: c.incomeGroup, indicators };
}

const sources = { ...testSources };

describe("assemble", () => {
  it("includes complete countries and lists them in the index", () => {
    const { countries, index } = assemble([raw()], sources, "test-1");
    expect(countries.map((c) => c.iso3)).toEqual(["AAA"]);
    expect(index.countries[0]).toMatchObject({ iso3: "AAA", birthsPerYear: 100_000, population: 5_000_000 });
    expect(index.dataVersion).toBe("test-1");
  });

  it.each(["demography.lifeTable", "demography.birthsPerYear", "money.percentiles", "health.causeMix"])(
    "excludes a country missing the core indicator %s and says why",
    (path) => {
      const { countries, index } = assemble([raw({}, [path])], sources, "v");
      expect(countries).toEqual([]);
      expect(index.excluded).toEqual([{ iso3: "AAA", iso2: "AA", name: "Testland", missing: [path] }]);
    },
  );

  it("excludes a country with no income group", () => {
    const r = raw();
    delete r.incomeGroup;
    expect(assemble([r], sources, "v").index.excluded[0]!.missing).toEqual(["incomeGroup"]);
  });

  it("fills a missing secondary indicator from the population-weighted regional average, flagged as estimated", () => {
    const a = raw({ iso3: "AAA" }, ["work.unemployment"]);
    const b = raw({ iso3: "BBB" });
    const c = raw({ iso3: "CCC" });
    (b.indicators["work.unemployment"] as { value: number }).value = 0.1;
    (b.indicators["demography.population"] as { value: number }).value = 1_000_000;
    (c.indicators["work.unemployment"] as { value: number }).value = 0.2;
    (c.indicators["demography.population"] as { value: number }).value = 3_000_000;

    const filled = assemble([a, b, c], sources, "v").countries.find((x) => x.iso3 === "AAA")!;
    expect(filled.work.unemployment.value).toBeCloseTo(0.175);
    expect(filled.work.unemployment.estimated).toBe(true);
    expect(filled.work.unemployment.source).toBe("estimate");
  });

  it("averages values split by sex field by field", () => {
    const a = raw({ iso3: "AAA" }, ["education.literacy"]);
    const b = raw({ iso3: "BBB" });
    (b.indicators["education.literacy"] as { value: unknown }).value = { female: 0.4, male: 0.6 };
    const filled = assemble([a, b], sources, "v").countries.find((x) => x.iso3 === "AAA")!;
    expect(filled.education.literacy.value).toEqual({ female: 0.4, male: 0.6 });
  });

  it("falls back to the income group when the region has no data, then to the world", () => {
    const a = raw({ iso3: "AAA", region: "Lonely" }, ["work.childLabour"]);
    const b = raw({ iso3: "BBB", region: "Elsewhere", incomeGroup: "lower-middle" });
    (b.indicators["work.childLabour"] as { value: number }).value = 0.3;
    const c = raw({ iso3: "CCC", region: "Elsewhere", incomeGroup: "high" });
    (c.indicators["work.childLabour"] as { value: number }).value = 0.01;
    const filled = assemble([a, b, c], sources, "v").countries.find((x) => x.iso3 === "AAA")!;
    expect(filled.work.childLabour.value).toBeCloseTo(0.3);

    const d = raw({ iso3: "DDD", region: "Lonely", incomeGroup: "upper-middle" }, ["work.childLabour"]);
    const world = assemble([d, b, c], sources, "v").countries.find((x) => x.iso3 === "DDD")!;
    // World average, weighted by population (both 5,000,000 in the fixture).
    expect(world.work.childLabour.value).toBeCloseTo((0.3 + 0.01) / 2);
  });

  it("produces countries that pass validation, including the estimate source", () => {
    const { countries, index } = assemble(
      [raw({ iso3: "AAA" }, ["work.unemployment"]), raw({ iso3: "BBB" })],
      sources,
      "v",
    );
    for (const c of countries) expect(validateCountry(c, index.sources)).toEqual([]);
    expect(index.sources.estimate).toBeDefined();
  });

  it("sorts countries by ISO code for stable output", () => {
    const { countries } = assemble([raw({ iso3: "CCC" }), raw({ iso3: "AAA" })], sources, "v");
    expect(countries.map((c) => c.iso3)).toEqual(["AAA", "CCC"]);
  });
});
