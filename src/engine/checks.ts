// Statistical checks (SIM-005): yearly probabilities taken straight from world data, each on its
// own random stream. Family deaths live in family.ts; child labour is here.
import type { Rng } from "./rng";
import type { Person } from "./types";
import type { Country } from "./world/types";

/** Ages the child-labour share is applied to: [from, to], inclusive. */
export const CHILD_LABOUR_AGES = [7, 14] as const;

/** Chance a working child stops in a year. */
const STOP_RATE = 0.2;

/**
 * Whether the person is a working child this year. The country's child-labour share (ILO) is
 * the share of children at work at every age in range. Poorer households are far more likely:
 * the household's weight runs from about 2x (poorest) to 0 (richest) and averages 1 across the
 * 100 percentiles, so the country's share is kept. Each year a working child keeps working with
 * probability 1 - STOP_RATE, and one who is not starts at the rate that holds the share steady.
 * Always draws exactly one number.
 */
export function childLabourStatus(person: Person, country: Country, rng: Rng): boolean {
  const roll = rng.next();
  const [from, to] = CHILD_LABOUR_AGES;
  if (person.age < from || person.age > to) return false;
  const weight = (2 - person.money.householdPercentile / 50) / 0.99;
  const share = Math.min(1, country.work.childLabour.value * weight);
  if (person.age === from) return roll < share;
  if (person.flags.childLabour === true) return roll < 1 - STOP_RATE;
  const start = share >= 1 ? 1 : (STOP_RATE * share) / (1 - share);
  return roll < Math.min(1, start);
}
