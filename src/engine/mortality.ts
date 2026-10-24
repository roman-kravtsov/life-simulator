// Yearly mortality (HEALTH-002, design 3.5) and the cause of death (HEALTH-003).
import { conditionCatalog } from "../content/healthConditions";
import { healthNorm } from "./drift";
import { clamp } from "./dist";
import { conditionHazard, expectedHazardFactor } from "./health";
import type { Rng } from "./rng";
import type { CauseId, HealthCondition, Person, Sex } from "./types";
import type { Country } from "./world/types";

export const HAZARD_MIN = 0.5;
export const HAZARD_MAX = 4;

/** Calibration constant (log scale): the mean of exp(spread) is above 1, so the centre sits a little below 0. */
const HAZARD_OFFSET = -0.045;

/** Deaths of newborns come on average this far into the first year; later ages die mid-year. */
const FIRST_YEAR_FRACTION = 0.1;

/**
 * Years a person lives on average, from the life table: completed years plus the part of the year
 * in which they die. `fromAge` is the age of the first table entry (0 for a newborn).
 */
export function lifeExpectancy(qx: readonly number[], fromAge = 0): number {
  let alive = 1;
  let years = 0;
  qx.forEach((q, i) => {
    const part = fromAge + i === 0 ? FIRST_YEAR_FRACTION : 0.5;
    years += alive * (1 - q) * 1 + alive * q * part;
    alive *= 1 - q;
  });
  return years;
}

/**
 * How much more or less likely this person is to die this year than the country's table says,
 * bounded to 0.5x to 4x. Terms are centred so the population average stays near 1, which the
 * calibration harness checks against life expectancy.
 */
export function hazardMultiplier(person: Person, country: Country): number {
  const urbanShare = country.demography.urbanShare.value;
  let log = HAZARD_OFFSET;
  log += (1.2 * (healthNorm(person, country) - person.stats.health)) / 100;
  log -= 0.12 * person.traits.constitution;
  log += (0.2 * (50 - person.money.percentile)) / 50;
  log += person.location === "rural" ? 0.08 * urbanShare : -0.08 * (1 - urbanShare);
  // Conditions decide who among people of one age dies; the life table decides how many, so the
  // average they add at this age and sex is taken out.
  log += conditionHazard(person.conditions, conditionCatalog);
  log -= Math.log(expectedHazardFactor(country, person.sex, person.age, conditionCatalog));
  return clamp(Math.exp(log), HAZARD_MIN, HAZARD_MAX);
}

/** Probability of dying within the year just starting at the person's age. */
export function deathProbability(person: Person, country: Country): number {
  const table = country.demography.lifeTable.value[person.sex];
  const qx = table[Math.min(person.age, table.length - 1)]!;
  return qx >= 1 ? 1 : Math.min(1, qx * hazardMultiplier(person, country));
}

export const rollDeath = (person: Person, country: Country, rng: Rng) => rng.chance(deathProbability(person, country));

/** How much each severity point of a condition raises the weight of the cause it points to. */
const CONDITION_NUDGE = 1.5;

/** Draws the cause of death from the country's mix for the age band and sex, nudged by conditions. */
export function drawCause(
  country: Country,
  sex: Sex,
  age: number,
  conditions: readonly HealthCondition[],
  rng: Rng,
): CauseId {
  const mix = country.health.causeMix.value;
  let band = mix.bands.findIndex(([from, to]) => age >= from && age < to);
  if (band === -1) band = mix.bands.length - 1;
  const shares = mix[sex][band]!;
  const causes = Object.keys(shares);
  const weights = causes.map((cause) => {
    const nudge = conditions.reduce((sum, c) => (c.raises === cause ? sum + CONDITION_NUDGE * c.severity : sum), 0);
    return shares[cause]! * (1 + nudge);
  });
  return rng.weighted(causes, weights);
}
