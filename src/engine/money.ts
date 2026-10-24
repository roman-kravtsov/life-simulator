import type { Rng } from "./rng";
import type { Country } from "./world/types";

/** Household percentile at birth, uniform so the whole income distribution is represented (design 3.6). */
export const drawHouseholdPercentile = (rng: Rng) => rng.int(1, 100);

/** Daily income or consumption per person, in PPP dollars, at a percentile of the country's distribution. */
export function dailyIncome(country: Country, percentile: number): number {
  const table = country.money.percentiles.value;
  return table[Math.min(table.length, Math.max(1, percentile)) - 1]!;
}

/** The tenth of the country a household falls in: 1 is the poorest ten percent, 10 the richest. */
export const householdBand = (percentile: number) => Math.ceil(percentile / 10);
