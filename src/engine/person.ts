// The person at birth (CHAR-001, CHAR-003, WORLD-009, MONEY-001, FAM-001).
import { namesForRegion } from "../content/names";
import { healthNorm } from "./drift";
import { generateParents } from "./family";
import { drawHouseholdPercentile } from "./money";
import { stream } from "./rng";
import { TRAIT_IDS, type Person, type Traits } from "./types";
import type { Country } from "./world/types";

const TRAIT_VALUES = [-2, -1, 0, 1, 2];
/** Roughly a bell curve: most people sit near the middle of each trait. */
const TRAIT_WEIGHTS = [1, 4, 6, 4, 1];

/**
 * A newborn in `country`, fully determined by the seed. Draws from the "person" stream in a
 * fixed order (sex, place, household, traits); names and family have their own streams.
 */
export function generatePerson(seed: string, country: Country): Person {
  const rng = stream(seed, "person", 0);
  const sexRatio = country.demography.sexRatioAtBirth.value;
  const sex = rng.chance(sexRatio / (1 + sexRatio)) ? "male" : "female";
  const location = rng.chance(country.demography.urbanShare.value) ? "urban" : "rural";
  const householdPercentile = drawHouseholdPercentile(rng);
  const traits = Object.fromEntries(TRAIT_IDS.map((id) => [id, rng.weighted(TRAIT_VALUES, TRAIT_WEIGHTS)])) as Traits;

  const names = stream(seed, "names", 0);
  const list = namesForRegion(country.region)[sex];
  const name = list[names.int(0, list.length - 1)]!;
  const parents = generateParents(stream(seed, "family", 0), country, names);
  const parentCloseness = parents.reduce((sum, p) => sum + p.closeness, 0) / parents.length;

  const newborn: Person = {
    name,
    sex,
    birthYear: country.demography.lifeTable.year,
    countryIso3: country.iso3,
    age: 0,
    stage: "infancy",
    alive: true,
    traits,
    stats: { health: 0, wellbeing: 65, bonds: 40 + 0.4 * parentCloseness, skills: 0 },
    location,
    money: { householdPercentile, savings: 0, debt: 0 },
    relationships: parents,
    conditions: [],
    flags: {},
  };
  return { ...newborn, stats: { ...newborn.stats, health: healthNorm(newborn, country) } };
}
