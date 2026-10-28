// The births in the countries left out of the game (WORLD-014), from the index alone.
import type { CountryIndex, ExcludedCountry } from "./types";

export interface ExcludedBirths {
  /** Births a year in the left-out countries that have a births figure. */
  excluded: number;
  /** Births a year in the included and the left-out countries together. */
  total: number;
  /** `excluded` over `total`, 0 to 1. */
  share: number;
  year: number;
  /** The left-out countries with the most births, largest first. */
  largest: ExcludedCountry[];
}

export function excludedBirths(index: CountryIndex, top = 4): ExcludedBirths {
  const counted = index.excluded.filter((c) => c.birthsPerYear !== undefined);
  const excluded = counted.reduce((sum, c) => sum + c.birthsPerYear!, 0);
  const total = excluded + index.countries.reduce((sum, c) => sum + c.birthsPerYear, 0);
  const largest = [...counted].sort((a, b) => b.birthsPerYear! - a.birthsPerYear!).slice(0, top);
  return { excluded, total, share: total > 0 ? excluded / total : 0, year: index.birthsYear, largest };
}
