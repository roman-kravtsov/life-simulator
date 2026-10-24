// SYNTHETIC test fixture. These numbers are invented for tests only and are
// never shipped or shown as facts about any country.
import type { CauseMix, Country, CountryIndex, Sourced } from "../../src/engine/world/types";

const s = <T>(value: T): Sourced<T> => ({ value, source: "test", year: 2023 });

/** A flat-ish synthetic life table: low infant risk, rising with age, 1 at 100. */
export function syntheticLifeTable(): number[] {
  return Array.from({ length: 101 }, (_, age) => (age === 100 ? 1 : Math.min(0.9, 0.0005 * Math.exp(age / 12))));
}

export function makeCountry(overrides: Partial<Country> = {}): Country {
  return {
    iso3: "AAA",
    iso2: "AA",
    name: "Testland",
    region: "Test Region",
    incomeGroup: "lower-middle",
    demography: {
      lifeTable: s({ female: syntheticLifeTable(), male: syntheticLifeTable() }),
      birthsPerYear: s(100_000),
      population: s(5_000_000),
      sexRatioAtBirth: s(1.05),
      tfr: s(2.4),
      meanAgeAtBirth: s(28),
      urbanShare: s(0.5),
    },
    money: {
      percentiles: s(Array.from({ length: 100 }, (_, i) => 1 + i * 0.5)),
      welfareType: "consumption",
      intergenerationalPersistence: s(0.5),
      healthOutOfPocketShare: s(0.3),
    },
    education: {
      primaryCompletion: s({ female: 0.9, male: 0.9 }),
      lowerSecondaryCompletion: s({ female: 0.7, male: 0.7 }),
      upperSecondaryCompletion: s({ female: 0.5, male: 0.5 }),
      tertiaryEnrolment: s({ female: 0.2, male: 0.2 }),
      literacy: s({ female: 0.85, male: 0.9 }),
    },
    work: {
      labourParticipation: s({ female: 0.5, male: 0.75 }),
      unemployment: s(0.06),
      sectorShares: s({ agriculture: 0.3, industry: 0.2, services: 0.5 }),
      informalShare: s(0.6),
      childLabour: s(0.1),
    },
    family: {
      meanAgeFirstMarriage: s({ female: 23, male: 27 }),
      childMarriageBy18: s(0.15),
    },
    health: {
      causeMix: s<CauseMix>({
        bands: [
          [0, 15],
          [15, 50],
          [50, 101],
        ],
        female: [
          { infectious: 0.6, injury: 0.4 },
          { injury: 0.5, noncommunicable: 0.4, suicide: 0.1 },
          { noncommunicable: 0.9, infectious: 0.1 },
        ],
        male: [
          { infectious: 0.6, injury: 0.4 },
          { injury: 0.6, noncommunicable: 0.3, suicide: 0.1 },
          { noncommunicable: 0.9, infectious: 0.1 },
        ],
      }),
      suicideRate: s(8),
    },
    ...overrides,
  };
}

export const testSources: CountryIndex["sources"] = {
  test: {
    title: "Synthetic test data",
    publisher: "Tests",
    url: "https://example.invalid",
    licence: "n/a",
    version: "test",
    accessed: "2026-10-24",
  },
};

/** A world loader backed by one synthetic country, for store and UI tests. */
export function testWorld(country: Country = makeCountry({ region: "Western Africa" })) {
  const index: CountryIndex = {
    dataVersion: "test",
    countries: [
      {
        iso3: country.iso3,
        iso2: country.iso2,
        name: country.name,
        region: country.region,
        incomeGroup: country.incomeGroup,
        birthsPerYear: country.demography.birthsPerYear.value,
        population: country.demography.population.value,
      },
    ],
    excluded: [],
    sources: testSources,
  };
  return {
    loadIndex: () => Promise.resolve(index),
    loadCountry: () => Promise.resolve(country),
  };
}
