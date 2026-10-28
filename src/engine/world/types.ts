// World data schema (design 2.1). Files are produced by the data pipeline in
// scripts/data/ from the primary publishers listed in docs/analysis.md 1.7.
// Every indicator carries its source and year.

export type SourceId = string;

export interface Sourced<T> {
  value: T;
  source: SourceId;
  /** Reference year of the value, not the download year. */
  year: number;
  /** True when filled from a regional or income-group average because the country has no value. */
  estimated?: boolean;
}

export interface BySex<T> {
  female: T;
  male: T;
}

export type IncomeGroup = "low" | "lower-middle" | "upper-middle" | "high";

export interface SourceInfo {
  title: string;
  publisher: string;
  url: string;
  licence: string;
  /** Edition or release used, e.g. "WPP 2024". */
  version: string;
  /** ISO date the files were downloaded. */
  accessed: string;
}

/** Age bands for cause-of-death shares; [from, to) in years. */
export type AgeBand = [number, number];

export interface CauseMix {
  bands: AgeBand[];
  /** One record per band: cause id -> share of deaths in that band (shares sum to 1). */
  female: Record<string, number>[];
  male: Record<string, number>[];
}

export interface Country {
  iso3: string;
  /** ISO 3166-1 alpha-2, used to name the country in the player's language (Intl.DisplayNames). */
  iso2: string;
  /** English name from the source (UN WPP); the game shows `Intl.DisplayNames` names and falls back to this. */
  name: string;
  /** UN M49 region name. */
  region: string;
  incomeGroup: IncomeGroup;
  demography: {
    /** qx by single age 0..100: probability of dying within the year (UN WPP). The last value is 1. */
    lifeTable: Sourced<BySex<number[]>>;
    birthsPerYear: Sourced<number>;
    population: Sourced<number>;
    /** Male births per female birth. */
    sexRatioAtBirth: Sourced<number>;
    /** Children per woman. */
    tfr: Sourced<number>;
    meanAgeAtBirth: Sourced<number>;
    /** Share of the population living in urban areas, 0..1. */
    urbanShare: Sourced<number>;
  };
  money: {
    /** 100 ascending values: daily income or consumption per person at each percentile, PPP$ (World Bank PIP). */
    percentiles: Sourced<number[]>;
    welfareType: "income" | "consumption";
    /** 0..1: how strongly a child's schooling follows the parents' (correlation, World Bank GDIM, 1980 cohort). */
    intergenerationalPersistence: Sourced<number>;
    /** Share of health spending paid out of pocket, 0..1. */
    healthOutOfPocketShare: Sourced<number>;
  };
  education: {
    primaryCompletion: Sourced<BySex<number>>;
    lowerSecondaryCompletion: Sourced<BySex<number>>;
    upperSecondaryCompletion: Sourced<BySex<number>>;
    tertiaryEnrolment: Sourced<BySex<number>>;
    literacy: Sourced<BySex<number>>;
  };
  work: {
    labourParticipation: Sourced<BySex<number>>;
    unemployment: Sourced<number>;
    sectorShares: Sourced<{ agriculture: number; industry: number; services: number }>;
    informalShare: Sourced<number>;
    childLabour: Sourced<number>;
  };
  family: {
    meanAgeFirstMarriage: Sourced<BySex<number>>;
    /** Share of women married before 18, 0..1. */
    childMarriageBy18: Sourced<number>;
  };
  health: {
    causeMix: Sourced<CauseMix>;
    /** Deaths per 100,000 per year. */
    suicideRate: Sourced<number>;
  };
}

export interface CountryIndexEntry {
  iso3: string;
  iso2: string;
  name: string;
  region: string;
  incomeGroup: IncomeGroup;
  birthsPerYear: number;
  population: number;
}

export interface ExcludedCountry {
  iso3: string;
  iso2: string;
  name: string;
  /** Core indicators the country has no data for. */
  missing: string[];
  /** Births a year (same edition and year as `CountryIndex.birthsYear`), when the source has them. */
  birthsPerYear?: number;
}

export interface CountryIndex {
  dataVersion: string;
  /** The year of the births figures, included and excluded alike. */
  birthsYear: number;
  countries: CountryIndexEntry[];
  excluded: ExcludedCountry[];
  sources: Record<SourceId, SourceInfo>;
}
