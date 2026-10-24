// Baseline stat drift (SIM-004) and the health stat (HEALTH-001). Each year stats move part of the
// way toward a norm that depends on age, traits, household, place and country. The curves below
// are data, kept at the top so they can be tuned and tested. School and work arrive in M4 and
// replace the schooling stand-in in `skillGrowth`.
import { clamp } from "./dist";
import type { Rng } from "./rng";
import type { Person, Stats } from "./types";
import type { Country, IncomeGroup } from "./world/types";

/** Health the average person in good circumstances sits at, by age: [age, value], linear in between. */
const HEALTH_CURVE: readonly (readonly [number, number])[] = [
  [0, 78],
  [5, 84],
  [15, 88],
  [30, 84],
  [45, 76],
  [60, 66],
  [75, 52],
  [90, 36],
  [100, 28],
];

/** Access to care by income group, in health points. */
const CARE_BY_INCOME_GROUP: Record<IncomeGroup, number> = { low: -4, "lower-middle": -2, "upper-middle": 0, high: 2 };

const RATE = { health: 0.5, wellbeing: 0.4, bonds: 0.3 } as const;

/** Skill points gained per year by age band before traits, access and ceiling: [from age, gain]. */
const SKILL_GAIN: readonly (readonly [number, number])[] = [
  [0, 1.5],
  [6, 4.5],
  [18, 2],
  [30, 0.8],
  [65, -0.4],
];

const SKILL_CEILING = 110;

function interpolate(curve: readonly (readonly [number, number])[], x: number): number {
  const last = curve.at(-1)!;
  if (x >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]!;
    if (x <= x1) {
      const [x0, y0] = curve[i - 1]!;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return curve[0]![1];
}

const childLabour = (person: Person) => person.flags.childLabour === true;

/** The health this person drifts toward this year. */
export function healthNorm(person: Person, country: Country): number {
  return clamp(
    interpolate(HEALTH_CURVE, person.age) +
      4 * person.traits.constitution +
      (3 * (person.money.householdPercentile - 50)) / 50 +
      CARE_BY_INCOME_GROUP[country.incomeGroup] -
      (person.location === "rural" ? 2 : 0) -
      (childLabour(person) ? 3 : 0),
    0,
    100,
  );
}

const wellbeingNorm = (person: Person) =>
  62 +
  3 * person.traits.resilience -
  (4 * (50 - person.money.householdPercentile)) / 50 +
  0.1 * (person.stats.bonds - 50) -
  (childLabour(person) ? 3 : 0);

function bondsNorm(person: Person): number {
  const parents = person.relationships.filter((r) => r.alive && (r.kind === "mother" || r.kind === "father"));
  if (person.age < 18) {
    const closeness = parents.length ? parents.reduce((sum, r) => sum + r.closeness, 0) / parents.length : 0;
    return 25 + 0.45 * closeness + 4 * person.traits.sociability;
  }
  return 52 + 5 * person.traits.sociability;
}

/** How much of school or workplace learning the child or young adult can reach, 0 to 1. */
function schoolAccess(person: Person, country: Country): number {
  const { education } = country;
  const { age, sex } = person;
  if (age < 6) return 1;
  if (age <= 11) return education.primaryCompletion.value[sex];
  if (age <= 14) return education.lowerSecondaryCompletion.value[sex];
  if (age <= 17) return education.upperSecondaryCompletion.value[sex];
  if (age <= 29) return 0.5 + 0.5 * education.upperSecondaryCompletion.value[sex];
  return 1;
}

/** Skill points gained (or lost, in old age) this year. */
export function skillGrowth(person: Person, country: Country): number {
  const band = [...SKILL_GAIN].reverse().find(([from]) => person.age >= from)!;
  let gain = band[1];
  if (gain < 0) return gain;
  gain *= schoolAccess(person, country);
  if (person.age >= 6 && person.age <= 17 && person.location === "rural") gain *= 0.85;
  if (childLabour(person)) gain *= 0.5;
  gain *= 1 + 0.12 * person.traits.aptitude + 0.08 * person.traits.curiosity;
  return gain * (1 - person.stats.skills / SKILL_CEILING);
}

const swing = (rng: Rng, amplitude: number) => (rng.next() - 0.5) * 2 * amplitude;

/** The stats at the end of this year's drift. Draws a fixed four numbers whatever the person's state. */
export function driftStats(person: Person, country: Country, rng: Rng): Stats {
  const { stats } = person;
  const healthNoise = swing(rng, 1.5);
  const wellbeingNoise = swing(rng, 2 + 1.5 * (person.traits.temperament + 2));
  const bondsNoise = swing(rng, 2);
  swing(rng, 0); // kept so that adding a noise term later does not shift the others
  return {
    health: clamp(stats.health + RATE.health * (healthNorm(person, country) - stats.health) + healthNoise, 0, 100),
    wellbeing: clamp(
      stats.wellbeing + RATE.wellbeing * (wellbeingNorm(person) - stats.wellbeing) + wellbeingNoise,
      0,
      100,
    ),
    bonds: clamp(stats.bonds + RATE.bonds * (bondsNorm(person) - stats.bonds) + bondsNoise, 0, 100),
    skills: clamp(stats.skills + skillGrowth(person, country), 0, 100),
  };
}
