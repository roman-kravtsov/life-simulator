// Checks the committed output of `npm run data` (WORLD-002, WORLD-003, WORLD-004, WORLD-007).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { Country, CountryIndex } from "../../src/engine/world/types";
import { validateCountry } from "../../src/engine/world/validate";

const DIR = "public/data";
const read = <T>(path: string) => JSON.parse(readFileSync(join(DIR, path), "utf8")) as T;

const index = read<CountryIndex>("index.json");
const files = readdirSync(join(DIR, "countries")).sort();

const sourcesCited = (node: unknown, found = new Set<string>()): Set<string> => {
  if (typeof node === "object" && node !== null) {
    if ("source" in node && "year" in node) found.add((node as { source: string }).source);
    Object.values(node).forEach((child) => sourcesCited(child, found));
  }
  return found;
};

describe("world data files", () => {
  it("has one file per country in the index, and no others", () => {
    expect(files).toEqual(index.countries.map((c) => `${c.iso3}.json`).sort());
    expect(index.countries.length).toBeGreaterThan(100);
  });

  it("reports why each excluded country is left out, and none is also included", () => {
    expect(index.excluded.length).toBeGreaterThan(0);
    const included = new Set(index.countries.map((c) => c.iso3));
    for (const e of index.excluded) {
      expect(e.missing.length, e.iso3).toBeGreaterThan(0);
      expect(included.has(e.iso3), e.iso3).toBe(false);
    }
  });

  it.each(files)("%s validates, is under 15 KB gzipped and matches the index", (file) => {
    const text = readFileSync(join(DIR, "countries", file), "utf8");
    const country = JSON.parse(text) as Country;
    expect(validateCountry(country, index.sources)).toEqual([]);
    expect(gzipSync(text).length).toBeLessThan(15 * 1024);
    const entry = index.countries.find((c) => c.iso3 === country.iso3)!;
    expect(entry).toMatchObject({
      iso2: country.iso2,
      name: country.name,
      region: country.region,
      incomeGroup: country.incomeGroup,
      birthsPerYear: country.demography.birthsPerYear.value,
      population: country.demography.population.value,
    });
  });

  it("flags exactly the filled-in values as estimated (WORLD-004)", () => {
    const check = (node: unknown, where: string) => {
      if (typeof node !== "object" || node === null) return;
      if ("source" in node && "year" in node) {
        const sourced = node as { source: string; estimated?: boolean };
        expect(sourced.source === "estimate", where).toBe(sourced.estimated === true);
        return;
      }
      for (const [key, child] of Object.entries(node)) check(child, `${where}.${key}`);
    };
    for (const file of files) check(read<Country>(`countries/${file}`), file);
  });

  it("lists every source the files cite, with publisher, licence, edition and access date (WORLD-007)", () => {
    const cited = new Set<string>();
    for (const file of files) sourcesCited(read<Country>(`countries/${file}`), cited);
    expect([...cited].sort()).toEqual(Object.keys(index.sources).sort());
    for (const [id, source] of Object.entries(index.sources)) {
      for (const field of ["title", "publisher", "url", "licence", "version", "accessed"] as const)
        expect(source[field], `${id}.${field}`).toBeTruthy();
    }
  });

  it("never gives core indicators as estimates (WORLD-003)", () => {
    for (const file of files) {
      const c = read<Country>(`countries/${file}`);
      for (const value of [c.demography.lifeTable, c.demography.birthsPerYear, c.money.percentiles, c.health.causeMix])
        expect(value.estimated, file).toBeUndefined();
    }
  });
});
