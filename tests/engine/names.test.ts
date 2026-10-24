import { describe, expect, it } from "vitest";
import { NAME_LISTS, REGION_NAME_GROUP, namesForRegion } from "../../src/content/names";
import { readFileSync } from "node:fs";
import type { CountryIndex } from "../../src/engine/world/types";

describe("name lists (CHAR-002)", () => {
  it.each(Object.entries(NAME_LISTS))("%s has at least 40 unique names per sex", (_group, list) => {
    for (const names of [list.female, list.male]) {
      expect(names.length).toBeGreaterThanOrEqual(40);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) expect(name).toMatch(/^[A-Z][A-Za-z-]+$/);
    }
  });
  it("maps every region of every included country to a list", () => {
    const index = JSON.parse(readFileSync("public/data/index.json", "utf8")) as CountryIndex;
    for (const country of index.countries) {
      expect(() => namesForRegion(country.region), country.iso3).not.toThrow();
      expect(namesForRegion(country.region).female.length).toBeGreaterThanOrEqual(40);
    }
  });
  it("only maps regions to groups that exist", () => {
    for (const group of Object.values(REGION_NAME_GROUP)) expect(NAME_LISTS).toHaveProperty([group]);
  });
  it("rejects an unknown region instead of guessing", () => {
    expect(() => namesForRegion("Atlantis")).toThrow(/Atlantis/);
  });
});
