// Baseline stat drift (SIM-004) and the health stat (HEALTH-001). Each year stats move part of the
// way toward a norm that depends on age, traits, household, place and country. The curves below
// are data, kept at the top so they can be tuned and tested. Skills grow with school (EDU-001) and
// with work.
import { clamp } from "./dist";
import { SCHOOL_START_AGE, levelAtAge } from "./education";
import { conditionCatalog } from "../content/healthConditions";
import { healthPenalty } from "./health";
import { debtStress } from "./money";
import { jobHealthPenalty } from "./work";
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

const RATE = { health: 0.5, happiness: 0.4, belonging: 0.3 } as const;

/** Skill points gained per year before traits, place and ceiling, by what the person is doing. */
const SKILL_GAIN = {
  infancy: 1.5,
  schoolLevel: { primary: 4.5, "lower-secondary": 4, "upper-secondary": 3.5, tertiary: 3.5 },
  /** Out of school before 18, learning what the household and village teach. */
  outOfSchool: 1,
  /** Working life: [from age, gain]. */
  adult: [
    [18, 1.6],
    [30, 0.8],
    [65, -0.4],
  ],
} as const;

/** Rural schools reach less, even for the children who stay. */
const RURAL_SCHOOL_QUALITY = 0.9;

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
      (3 * (person.money.percentile - 50)) / 50 +
      CARE_BY_INCOME_GROUP[country.incomeGroup] -
      (person.location === "rural" ? 2 : 0) -
      (childLabour(person) ? 3 : 0) -
      jobHealthPenalty(person) -
      healthPenalty(person.conditions, conditionCatalog) -
      3 * debtStress(person, country),
    0,
    100,
  );
}

export const happinessNorm = (person: Person, country: Country) =>
  62 +
  3 * person.traits.resilience -
  (4 * (50 - person.money.percentile)) / 50 +
  0.1 * (person.stats.belonging - 50) -
  (childLabour(person) ? 3 : 0) -
  6 * debtStress(person, country);

function belongingNorm(person: Person): number {
  const parents = person.relationships.filter((r) => r.alive && (r.kind === "mother" || r.kind === "father"));
  if (person.age < 18) {
    const closeness = parents.length ? parents.reduce((sum, r) => sum + r.closeness, 0) / parents.length : 0;
    return 25 + 0.45 * closeness + 4 * person.traits.sociability;
  }
  return 52 + 5 * person.traits.sociability;
}

/** Skill points gained (or lost, in old age) this year. */
export function skillGrowth(person: Person): number {
  const { age } = person;
  let gain: number;
  const level = person.education.inSchool ? levelAtAge(age) : undefined;
  if (level) gain = SKILL_GAIN.schoolLevel[level.id];
  else if (age < SCHOOL_START_AGE) gain = SKILL_GAIN.infancy;
  else if (age < 18) gain = SKILL_GAIN.outOfSchool;
  else gain = [...SKILL_GAIN.adult].reverse().find(([from]) => age >= from)![1];
  if (gain < 0) return gain;
  if (level && person.location === "rural") gain *= RURAL_SCHOOL_QUALITY;
  if (childLabour(person)) gain *= 0.5;
  gain *= 1 + 0.12 * person.traits.aptitude + 0.08 * person.traits.curiosity;
  return gain * (1 - person.stats.skills / SKILL_CEILING);
}

const swing = (rng: Rng, amplitude: number) => (rng.next() - 0.5) * 2 * amplitude;

/** The stats at the end of this year's drift. Draws a fixed four numbers whatever the person's state. */
export function driftStats(person: Person, country: Country, rng: Rng): Stats {
  const { stats } = person;
  const healthNoise = swing(rng, 1.5);
  const happinessNoise = swing(rng, 2 + 1.5 * (person.traits.temperament + 2));
  const belongingNoise = swing(rng, 2);
  swing(rng, 0); // kept so that adding a noise term later does not shift the others
  return {
    health: clamp(stats.health + RATE.health * (healthNorm(person, country) - stats.health) + healthNoise, 0, 100),
    happiness: clamp(
      stats.happiness + RATE.happiness * (happinessNorm(person, country) - stats.happiness) + happinessNoise,
      0,
      100,
    ),
    belonging: clamp(
      stats.belonging + RATE.belonging * (belongingNorm(person) - stats.belonging) + belongingNoise,
      0,
      100,
    ),
    skills: clamp(stats.skills + skillGrowth(person), 0, 100),
  };
}
