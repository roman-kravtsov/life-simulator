import { describe, expect, it } from "vitest";
import { validateCountry } from "../../src/engine/world/validate";
import { makeCountry, testSources } from "../fixtures/country";

const errors = (country = makeCountry()) => validateCountry(country, testSources);

describe("validateCountry", () => {
  it("accepts a well-formed country", () => {
    expect(errors()).toEqual([]);
  });

  it("requires a three-letter upper-case ISO code", () => {
    expect(errors(makeCountry({ iso3: "ab" }))).toContainEqual(expect.stringMatching(/iso3/));
  });

  it("requires a two-letter ISO 3166-1 alpha-2 code for country names", () => {
    expect(errors(makeCountry({ iso2: "a" }))).toContainEqual(expect.stringMatching(/iso2/));
  });

  it("requires a 101-value life table with probabilities ending at 1", () => {
    const c = makeCountry();
    c.demography.lifeTable.value.female = c.demography.lifeTable.value.female.slice(0, 50);
    expect(errors(c)).toContainEqual(expect.stringMatching(/lifeTable\.female/));

    const d = makeCountry();
    d.demography.lifeTable.value.male[10] = 1.5;
    expect(errors(d)).toContainEqual(expect.stringMatching(/lifeTable\.male/));

    const e = makeCountry();
    e.demography.lifeTable.value.male[100] = 0.5;
    expect(errors(e)).toContainEqual(expect.stringMatching(/lifeTable\.male.*age 100/));
  });

  it("requires 100 ascending, non-negative income percentiles", () => {
    const c = makeCountry();
    c.money.percentiles.value = [...c.money.percentiles.value].reverse();
    expect(errors(c)).toContainEqual(expect.stringMatching(/percentiles/));
  });

  it("requires shares between 0 and 1", () => {
    const c = makeCountry();
    c.demography.urbanShare.value = 1.2;
    c.education.literacy.value.female = -0.1;
    expect(errors(c)).toEqual(
      expect.arrayContaining([expect.stringMatching(/urbanShare/), expect.stringMatching(/literacy/)]),
    );
  });

  it("requires cause-of-death shares to sum to 1 in every band", () => {
    const c = makeCountry();
    c.health.causeMix.value.male[1] = { injury: 0.5 };
    expect(errors(c)).toContainEqual(expect.stringMatching(/causeMix\.male.*band 1/));
  });

  it("requires cause bands to cover ages 0 to 101 without gaps", () => {
    const c = makeCountry();
    c.health.causeMix.value.bands = [
      [0, 15],
      [20, 50],
      [50, 101],
    ];
    expect(errors(c)).toContainEqual(expect.stringMatching(/bands/));
  });

  it("requires every value to cite a known source and a plausible year", () => {
    const c = makeCountry();
    c.work.unemployment = { value: 0.05, source: "nowhere", year: 2023 };
    c.work.childLabour = { value: 0.05, source: "test", year: 1700 };
    expect(errors(c)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/unemployment.*source/),
        expect.stringMatching(/childLabour.*year/),
      ]),
    );
  });
});
