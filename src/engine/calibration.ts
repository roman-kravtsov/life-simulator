// The calibration harness (SIM-007): runs many lives headless and compares them with the source
// data. Life expectancy is checked today; school completion, marriage age and income spread join
// as the systems that produce them arrive (M4 and M5).
import { advance, newLife } from "./life";
import { lifeExpectancy } from "./mortality";
import type { LifeState } from "./types";
import type { Country } from "./world/types";

/** Simulated life expectancy may differ from the UN WPP value by at most this many years. */
export const LE_TOLERANCE_YEARS = 2;

/** One whole life with no player input. */
export function simulateLife(seed: string, country: Country): LifeState {
  let state = newLife({ seed, country });
  while (state.person.alive) state = advance(state, { kind: "continue" }, country).state;
  return state;
}

/** Life expectancy at birth from the country's tables, for the sexes born in the country's ratio. */
export function expectedLifeExpectancy(country: Country): number {
  const ratio = country.demography.sexRatioAtBirth.value;
  const male = ratio / (1 + ratio);
  const { female: f, male: m } = country.demography.lifeTable.value;
  return male * lifeExpectancy(m) + (1 - male) * lifeExpectancy(f);
}

export interface LifeExpectancyReport {
  lives: number;
  expected: number;
  simulated: number;
  /** simulated minus expected, in years. */
  difference: number;
}

export function calibrateLifeExpectancy(country: Country, lives: number, seedPrefix: string): LifeExpectancyReport {
  let years = 0;
  for (let i = 0; i < lives; i++) {
    const death = simulateLife(`${seedPrefix}-${i}`, country).death!;
    years += death.age + (death.age === 0 ? 0.1 : 0.5);
  }
  const simulated = years / lives;
  const expected = expectedLifeExpectancy(country);
  return { lives, expected, simulated, difference: simulated - expected };
}
