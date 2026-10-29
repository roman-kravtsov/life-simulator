// Baseline stat drift (SIM-004) and the health stat (HEALTH-001). Each year stats move part of the
// way toward a norm that depends on age, traits, household, place and country. The curves below
// are data, kept at the top so they can be tuned and tested. Skills grow with school (EDU-001) and
// with work.
import { clamp } from "./dist";
import { SCHOOL_START_AGE, levelAtAge } from "./education";
import { conditionCatalog } from "../content/healthConditions";
import { healthPenalty } from "./health";
import { FOCUS_EFFECT } from "./focus";
import { debtStress } from "./money";
import { isWorking, jobHealthPenalty } from "./work";
import type { Rng } from "./rng";
import type { DriftRecord, Person, StatId, Stats } from "./types";
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
      3 * debtStress(person, country) +
      // Points on Health above the default plan lift the health a person settles at; fewer let it sink (DEC-003).
      FOCUS_EFFECT.health.norm * (person.focus?.health ?? 0),
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
  (person.work.status === "unemployed" ? 3 : 0) -
  6 * debtStress(person, country) +
  FOCUS_EFFECT.rest.norm * (person.focus?.rest ?? 0);

function belongingNorm(person: Person): number {
  return baseBelongingNorm(person) + FOCUS_EFFECT.belonging.norm * (person.focus?.belonging ?? 0);
}

function baseBelongingNorm(person: Person): number {
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
  // School starts at six: the enrolment comes later in the same turn, but this year is a pupil's.
  const level = person.education.inSchool || age === SCHOOL_START_AGE ? levelAtAge(age) : undefined;
  if (level) gain = SKILL_GAIN.schoolLevel[level.id];
  else if (age < SCHOOL_START_AGE) gain = SKILL_GAIN.infancy;
  else if (age < 18) gain = SKILL_GAIN.outOfSchool;
  else gain = [...SKILL_GAIN.adult].reverse().find(([from]) => age >= from)![1];
  if (gain < 0) return gain;
  if (level && person.location === "rural") gain *= RURAL_SCHOOL_QUALITY;
  if (childLabour(person)) gain *= 0.5;
  gain *= 1 + 0.12 * person.traits.aptitude + 0.08 * person.traits.curiosity;
  // Points on Learn above the default plan add to what is picked up; fewer take away from it (DEC-003).
  gain *= Math.max(0.3, 1 + FOCUS_EFFECT.learn.skills * (person.focus?.learn ?? 0));
  // Points on Earn above the default plan are the effort of a working adult: more is learnt on the job (DEC-003, CAREER-006).
  if (age >= 18 && !person.education.inSchool && isWorking(person.work.status)) {
    gain *= Math.max(0.3, 1 + FOCUS_EFFECT.earn.skills * (person.focus?.earn ?? 0));
  }
  return gain * (1 - person.stats.skills / SKILL_CEILING);
}

const swing = (rng: Rng, amplitude: number) => (rng.next() - 0.5) * 2 * amplitude;

/** The year's random swings. Draws a fixed four numbers whatever the person's state. */
function driftNoise(person: Person, rng: Rng): Pick<Stats, "health" | "happiness" | "belonging"> {
  const health = swing(rng, 1.5);
  const happiness = swing(rng, 2 + 1.5 * (person.traits.temperament + 2));
  const belonging = swing(rng, 2);
  swing(rng, 0); // kept so that adding a noise term later does not shift the others
  return { health, happiness, belonging };
}

/** The stats at the end of this year's drift. */
export function driftStats(person: Person, country: Country, rng: Rng): Stats {
  const { stats } = person;
  const noise = driftNoise(person, rng);
  return {
    health: clamp(stats.health + RATE.health * (healthNorm(person, country) - stats.health) + noise.health, 0, 100),
    happiness: clamp(
      stats.happiness + RATE.happiness * (happinessNorm(person, country) - stats.happiness) + noise.happiness,
      0,
      100,
    ),
    belonging: clamp(
      stats.belonging + RATE.belonging * (belongingNorm(person) - stats.belonging) + noise.belonging,
      0,
      100,
    ),
    skills: clamp(stats.skills + skillGrowth(person), 0, 100),
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** What each stat drifts toward, and how fast: for skills the yearly gain, which is added as it is. */
function normsOf(person: Person, country: Country): Stats {
  return {
    health: healthNorm(person, country),
    happiness: happinessNorm(person, country),
    belonging: belongingNorm(person),
    skills: skillGrowth(person),
  };
}

/**
 * How a stat carries its past into the next year and how much of this year's norm it takes up: health,
 * happiness and belonging move part of the way toward the norm, and skills keep what they had and add
 * the whole of the year's gain (SUM-004 follows each source through the same filter).
 */
export const DRIFT_FILTER: Record<StatId, { keep: number; gain: number }> = {
  health: { keep: 1 - RATE.health, gain: RATE.health },
  happiness: { keep: 1 - RATE.happiness, gain: RATE.happiness },
  belonging: { keep: 1 - RATE.belonging, gain: RATE.belonging },
  skills: { keep: 1, gain: 1 },
};

/** Closeness to parents of the person with nothing dealt or chosen. */
const NEUTRAL_CLOSENESS = 50;

/**
 * The same person with nothing dealt by birth or by life: no traits, the middle of the country's income
 * distribution, a city, no child labour, no job, no debt, no conditions, parents of middling closeness. Where a stat
 * drifts for this person is the baseline that the person's circumstances move it away from.
 */
function neutralOf(person: Person): Person {
  const neutral: Person = {
    ...person,
    traits: { temperament: 0, curiosity: 0, resilience: 0, sociability: 0, aptitude: 0, constitution: 0 },
    stats: { ...person.stats, belonging: 50 },
    location: "urban",
    money: { ...person.money, percentile: 50, debt: 0 },
    work: { ...person.work, status: "child" },
    flags: { ...person.flags, childLabour: false },
    conditions: [],
    relationships: person.relationships.map((r) =>
      r.alive && (r.kind === "mother" || r.kind === "father") ? { ...r, closeness: NEUTRAL_CLOSENESS } : r,
    ),
  };
  delete neutral.focus;
  return neutral;
}

/**
 * Splits the year's drift for the summary (SUM-004), in the units of each stat's norm. The norm a stat
 * drifts toward differs from the neutral person's norm because of what the person was dealt
 * (circumstance: traits, household, place, income group, child labour, job, debt), because of the plan
 * the player lived by (choice), and because of conditions (chance). The year's random swing is chance too.
 * Draws the same numbers as `driftStats`, so give it a fresh stream of the same name and year.
 * Rounded to two places.
 */
export function driftBreakdown(person: Person, country: Country, rng: Rng): DriftRecord {
  const noise = driftNoise(person, rng);
  const unplanned: Person = { ...person };
  delete unplanned.focus;
  const withPlan = normsOf(person, country);
  const withoutPlan = normsOf(unplanned, country);
  const healthy = normsOf({ ...unplanned, conditions: [] }, country);
  const neutral = normsOf(neutralOf(person), { ...country, incomeGroup: "upper-middle" });
  const each = (make: (id: StatId) => number): Stats => ({
    health: round2(make("health")),
    happiness: round2(make("happiness")),
    belonging: round2(make("belonging")),
    skills: round2(make("skills")),
  });
  return {
    norm: {
      circumstance: each((id) => healthy[id] - neutral[id]),
      choice: each((id) => withPlan[id] - withoutPlan[id]),
      chance: each((id) => withoutPlan[id] - healthy[id]),
    },
    noise: each((id) => (id === "skills" ? 0 : noise[id])),
  };
}
