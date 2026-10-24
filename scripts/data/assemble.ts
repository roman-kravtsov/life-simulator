// Turns per-source extracts into country files (WORLD-003, WORLD-004).
// Countries missing a core indicator are excluded and reported. Missing
// secondary indicators are filled from a population-weighted average of the
// same region, then the same income group, then the world, and flagged.
import type { Country, CountryIndex, IncomeGroup, Sourced } from "../../src/engine/world/types";

/** Indicators that decide life and death; without them a country is left out. */
export const CORE = [
  "demography.lifeTable",
  "demography.birthsPerYear",
  "demography.population",
  "money.percentiles",
  "money.welfareType",
  "health.causeMix",
] as const;

/** Indicators that may be estimated from neighbours when missing. */
export const SECONDARY = [
  "demography.sexRatioAtBirth",
  "demography.tfr",
  "demography.meanAgeAtBirth",
  "demography.urbanShare",
  "money.intergenerationalPersistence",
  "money.healthOutOfPocketShare",
  "education.primaryCompletion",
  "education.lowerSecondaryCompletion",
  "education.upperSecondaryCompletion",
  "education.tertiaryEnrolment",
  "education.literacy",
  "work.labourParticipation",
  "work.unemployment",
  "work.sectorShares",
  "work.informalShare",
  "work.childLabour",
  "family.meanAgeFirstMarriage",
  "family.childMarriageBy18",
  "health.suicideRate",
] as const;

type IndicatorPath = (typeof CORE)[number] | (typeof SECONDARY)[number];

export interface RawCountry {
  iso3: string;
  name: string;
  region: string;
  incomeGroup?: IncomeGroup;
  /** Whatever the sources provided, keyed by indicator path (e.g. "work.unemployment"). */
  indicators: Partial<Record<IndicatorPath, unknown>>;
}

const ESTIMATE_SOURCE: CountryIndex["sources"][string] = {
  title: "Estimate from regional, income-group or world average",
  publisher: "Birthright data pipeline",
  url: "https://github.com/roman-kravtsov/life-simulator/blob/main/scripts/data/assemble.ts",
  licence: "Derived from the sources above",
  version: "pipeline",
  accessed: "n/a",
};

type Numeric = number | Record<string, number>;

/** Population-weighted mean of numbers, or of records of numbers field by field. */
function weightedMean(values: { value: Numeric; weight: number }[]): Numeric {
  const total = values.reduce((sum, v) => sum + v.weight, 0);
  const first = values[0]!.value;
  if (typeof first === "number") {
    return values.reduce((sum, v) => sum + (v.value as number) * v.weight, 0) / total;
  }
  const result: Record<string, number> = {};
  for (const key of Object.keys(first)) {
    result[key] = values.reduce((sum, v) => sum + (v.value as Record<string, number>)[key]! * v.weight, 0) / total;
  }
  return result;
}

export function assemble(
  raws: RawCountry[],
  sources: CountryIndex["sources"],
  dataVersion: string,
): { countries: Country[]; index: CountryIndex } {
  const excluded: CountryIndex["excluded"] = [];
  const included: RawCountry[] = [];

  for (const raw of raws) {
    const missing: string[] = CORE.filter((path) => raw.indicators[path] === undefined);
    if (!raw.incomeGroup) missing.push("incomeGroup");
    if (missing.length) excluded.push({ iso3: raw.iso3, name: raw.name, missing });
    else included.push(raw);
  }

  const population = (r: RawCountry) => (r.indicators["demography.population"] as Sourced<number>).value;

  const estimate = (target: RawCountry, path: IndicatorPath): Sourced<unknown> | undefined => {
    const donors = included.filter((r) => r !== target && r.indicators[path] !== undefined);
    const tiers = [
      donors.filter((r) => r.region === target.region),
      donors.filter((r) => r.incomeGroup === target.incomeGroup),
      donors,
    ];
    const tier = tiers.find((t) => t.length > 0);
    if (!tier) return undefined;
    const values = tier.map((r) => ({
      value: (r.indicators[path] as Sourced<Numeric>).value,
      weight: population(r),
    }));
    const year = Math.max(...tier.map((r) => (r.indicators[path] as Sourced<Numeric>).year));
    return { value: weightedMean(values), source: "estimate", year, estimated: true };
  };

  const countries: Country[] = [];
  for (const raw of included) {
    const values: Partial<Record<IndicatorPath, unknown>> = { ...raw.indicators };
    for (const path of SECONDARY) {
      if (values[path] === undefined) {
        const filled = estimate(raw, path);
        if (!filled) throw new Error(`No country has ${path}; cannot estimate it for ${raw.iso3}`);
        values[path] = filled;
      }
    }
    const country: Record<string, unknown> = {
      iso3: raw.iso3,
      name: raw.name,
      region: raw.region,
      incomeGroup: raw.incomeGroup,
    };
    for (const [path, value] of Object.entries(values)) {
      const [group, key] = path.split(".") as [string, string];
      ((country[group] ??= {}) as Record<string, unknown>)[key] = value;
    }
    countries.push(country as unknown as Country);
  }

  countries.sort((a, b) => a.iso3.localeCompare(b.iso3));
  excluded.sort((a, b) => a.iso3.localeCompare(b.iso3));

  return {
    countries,
    index: {
      dataVersion,
      countries: countries.map((c) => ({
        iso3: c.iso3,
        name: c.name,
        region: c.region,
        incomeGroup: c.incomeGroup,
        birthsPerYear: c.demography.birthsPerYear.value,
        population: c.demography.population.value,
      })),
      excluded,
      sources: { ...sources, estimate: ESTIMATE_SOURCE },
    },
  };
}
