// School (EDU-001) and literacy (EDU-002). A child starts primary school at six and each year
// either stays or leaves, level by level, until tertiary ends at 21. The yearly odds come from the
// country's completion rates: the chance of finishing a level, given that the child reached it, is
// the ratio of the two completion rates, and it is spread over the years of the level. A child's
// own odds are shifted by household, place and aptitude, and the shifts are scaled so that the
// average over the country's children still hits the published rate (the model below).
import { clamp } from "./dist";
import type { Effect } from "./effects";
import type { PendingEvent } from "./events";
import type { Rng } from "./rng";
import type { EducationLevel, Person, Sex } from "./types";
import type { Country } from "./world/types";

export interface SchoolLevel {
  id: Exclude<EducationLevel, "none">;
  /** First and last age spent at this level, inclusive. */
  from: number;
  to: number;
}

/** Where each level sits in the years of life. Real systems differ by country; one pattern keeps the model simple. */
export const LEVELS: readonly SchoolLevel[] = [
  { id: "primary", from: 6, to: 11 },
  { id: "lower-secondary", from: 12, to: 14 },
  { id: "upper-secondary", from: 15, to: 17 },
  { id: "tertiary", from: 18, to: 21 },
];

export const SCHOOL_START_AGE = 6;
/** Literacy is settled when the primary years are over. */
export const LITERACY_AGE = 12;

/**
 * An authored assumption, not a published figure: the share of tertiary students who finish.
 * UNESCO gives enrolment for tertiary, not completion, so completion is enrolment times this.
 */
export const TERTIARY_COMPLETION = 0.7;

/** Share of children who finish primary school and can read. Authored; the rest of literacy comes from the data. */
const LITERACY_OF_COMPLETERS = 0.97;

/** How strongly household wealth shifts the odds of leaving, as a share of the country's schooling persistence. */
const HOUSEHOLD_STRENGTH = 0.9;
/** How much more often rural children leave than the national average (urban children less often, so the mean holds). */
const RURAL_GAP = 0.3;
/** Each point of aptitude lowers the odds of leaving by this share. */
const APTITUDE_EFFECT = 0.12;

export const levelAtAge = (age: number): SchoolLevel | undefined => LEVELS.find((l) => age >= l.from && age <= l.to);

/** Households 1 to 100 weigh 1/100 each; the mean of (50.5 - percentile) over them is 0. */
const householdFactor = (strength: number, householdPercentile: number) =>
  1 + (strength * (50.5 - householdPercentile)) / 49.5;

function locationFactor(urbanShare: number, urban: boolean): number {
  return urban ? 1 - RURAL_GAP * (1 - urbanShare) : 1 + RURAL_GAP * urbanShare;
}

const strengthOf = (country: Country) =>
  clamp(HOUSEHOLD_STRENGTH * country.money.intergenerationalPersistence.value, 0, 0.9);

/** How much faster than the country's average a child's yearly odds of leaving run. Its mean over children is 1. */
export function leavingFactor(person: Person, country: Country): number {
  return (
    householdFactor(strengthOf(country), person.money.householdPercentile) *
    locationFactor(country.demography.urbanShare.value, person.location === "urban") *
    (1 - APTITUDE_EFFECT * person.traits.aptitude)
  );
}

/** Aptitude values 1:4:6:4:1 over -2..2, the weights traits are dealt with. */
const APTITUDES: readonly (readonly [number, number])[] = [
  [-2, 1 / 16],
  [-1, 4 / 16],
  [0, 6 / 16],
  [1, 4 / 16],
  [2, 1 / 16],
];

interface Combo {
  weight: number;
  factor: number;
}

function combos(country: Country): Combo[] {
  const urbanShare = country.demography.urbanShare.value;
  const strength = strengthOf(country);
  const out: Combo[] = [];
  for (let percentile = 1; percentile <= 100; percentile++) {
    for (const urban of [true, false]) {
      for (const [aptitude, share] of APTITUDES) {
        out.push({
          weight: (1 / 100) * (urban ? urbanShare : 1 - urbanShare) * share,
          factor:
            householdFactor(strength, percentile) *
            locationFactor(urbanShare, urban) *
            (1 - APTITUDE_EFFECT * aptitude),
        });
      }
    }
  }
  return out;
}

/** The cumulative completion rates by level for one sex: the share of a cohort that finishes each level. */
export function completionRates(country: Country, sex: Sex): number[] {
  const { education } = country;
  const cap = (x: number) => clamp(x, 0, 1);
  const primary = cap(education.primaryCompletion.value[sex]);
  const lower = Math.min(primary, cap(education.lowerSecondaryCompletion.value[sex]));
  const upper = Math.min(lower, cap(education.upperSecondaryCompletion.value[sex]));
  const tertiary = Math.min(upper, cap(education.tertiaryEnrolment.value[sex]) * TERTIARY_COMPLETION);
  return [primary, lower, upper, tertiary];
}

interface LevelModel {
  /** Chance of finishing the level given the child reached it. */
  chance: number;
  /** Yearly hazard of leaving for a child with leaving factor 1, after scaling to the country. */
  hazard: number;
}

interface SchoolingModel {
  levels: LevelModel[];
  attainment: Record<EducationLevel, number>;
  /** Share of a cohort in school during the year at each age (index 0 to 22). */
  inSchool: number[];
}

/** The scale on the yearly hazard at which the weighted mean chance of finishing equals `target`. */
function solveScale(target: number, baseHazard: number, years: number, items: readonly Combo[]): number {
  const total = items.reduce((sum, c) => sum + c.weight, 0);
  const mean = (scale: number) =>
    items.reduce((sum, c) => sum + c.weight * Math.exp(-scale * baseHazard * years * c.factor), 0) / total;
  let low = 0;
  let high = 64;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (mean(mid) > target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function buildModel(country: Country, sex: Sex): SchoolingModel {
  const rates = completionRates(country, sex);
  const base = combos(country);
  // Probability each combination has reached the level now being studied.
  const reached = base.map(() => 1);
  const levels: LevelModel[] = [];
  const inSchool = new Array<number>(23).fill(0);
  const completed: number[] = [];
  let previous = 1;
  LEVELS.forEach((level, i) => {
    const years = level.to - level.from + 1;
    const chance = previous > 0 ? Math.min(1, rates[i]! / previous) : 0;
    const weighted = base.map((c, k) => ({ weight: c.weight * reached[k]!, factor: c.factor }));
    let hazard = 0;
    if (chance > 0 && chance < 1) {
      const baseHazard = -Math.log(chance) / years;
      hazard = solveScale(chance, baseHazard, years, weighted) * baseHazard;
    }
    levels.push({ chance, hazard });
    // Share in school in each year of the level; nobody enrols at a level the country gives no chance to finish.
    for (let age = level.from; age <= level.to; age++) {
      inSchool[age] =
        chance > 0
          ? base.reduce(
              (sum, c, k) => sum + c.weight * reached[k]! * Math.exp(-hazard * c.factor * (age - level.from)),
              0,
            )
          : 0;
    }
    base.forEach((c, k) => {
      reached[k] = chance > 0 ? reached[k]! * Math.exp(-hazard * c.factor * years) : 0;
    });
    completed.push(base.reduce((sum, c, k) => sum + c.weight * reached[k]!, 0));
    previous = completed[i]!;
  });
  const [primary, lower, upper, tertiary] = completed as [number, number, number, number];
  return {
    levels,
    inSchool,
    attainment: {
      none: 1 - primary,
      primary: primary - lower,
      "lower-secondary": lower - upper,
      "upper-secondary": upper - tertiary,
      tertiary,
    },
  };
}

const models = new WeakMap<Country, Map<Sex, SchoolingModel>>();

function modelFor(country: Country, sex: Sex): SchoolingModel {
  let bySex = models.get(country);
  if (!bySex) models.set(country, (bySex = new Map()));
  let model = bySex.get(sex);
  if (!model) bySex.set(sex, (model = buildModel(country, sex)));
  return model;
}

/** Where a cohort ends up: the share whose highest completed level is each one. */
export const attainmentShares = (country: Country, sex: Sex) => ({ ...modelFor(country, sex).attainment });

/** The share of a cohort in school during the year at `age`, with household and place averaged out. */
export const inSchoolShare = (country: Country, sex: Sex, age: number) => modelFor(country, sex).inSchool[age] ?? 0;

/** The chance a child at `level` stays in school for the year, given the child's household, place and aptitude. */
export function continuationProbability(person: Person, country: Country, level: SchoolLevel["id"]): number {
  const index = LEVELS.findIndex((l) => l.id === level);
  const { chance, hazard } = modelFor(country, person.sex).levels[index]!;
  if (chance <= 0) return 0;
  if (chance >= 1) return 1;
  return Math.exp(-hazard * leavingFactor(person, country));
}

/** The chance of being able to read, given whether the child finished primary school (EDU-002). */
export function literacyChance(sex: Sex, country: Country, completedPrimary: boolean): number {
  const finished = completionRates(country, sex)[0]!;
  const literacy = clamp(country.education.literacy.value[sex], 0, 1);
  const ofFinishers = finished > 0 ? Math.min(LITERACY_OF_COMPLETERS, literacy / finished) : 0;
  if (completedPrimary) return ofFinishers;
  return finished >= 1 ? 0 : clamp((literacy - ofFinishers * finished) / (1 - finished), 0, 1);
}

const happier = (add: number): Effect => ({ stat: "happiness", add });

export interface EducationStep {
  person: Person;
  events: PendingEvent[];
}

/**
 * One year of school. A child starts at six; each year they stay or leave by their odds, and at the
 * last year of a level that level is completed. Always draws two numbers (stay or leave, literacy).
 */
export function stepEducation(person: Person, country: Country, rng: Rng): EducationStep {
  const stay = rng.next();
  const literacy = rng.next();
  const events: PendingEvent[] = [];
  let education = person.education;
  const { age } = person;

  if (age === SCHOOL_START_AGE && !education.inSchool) {
    education = { ...education, inSchool: true };
    events.push({ id: "school.starts", textKey: "event.school.starts", cause: "circumstance", effects: [] });
  }
  if (age === LITERACY_AGE) {
    education = { ...education, literate: literacy < literacyChance(person.sex, country, education.level !== "none") };
  }

  const level = levelAtAge(age);
  if (education.inSchool && !level) education = { ...education, inSchool: false };
  else if (education.inSchool && level) {
    const chance = continuationProbability({ ...person, education }, country, level.id);
    const noPlace = chance === 0 && age === level.from;
    if (noPlace) {
      // A level the country gives no chance to finish is not entered: no year counted, nothing to tell.
      education = { ...education, inSchool: false };
    } else if (stay >= chance) {
      education = { ...education, inSchool: false, years: education.years + 1 };
      events.push({
        id: "school.left",
        textKey: `event.school.left.${level.id}`,
        cause: "circumstance",
        effects: [happier(-2)],
      });
    } else {
      education = { ...education, years: education.years + 1 };
      if (age === level.to) {
        education = { ...education, level: level.id, inSchool: level.id !== "tertiary" };
        events.push({
          id: "school.completed",
          textKey: `event.school.completed.${level.id}`,
          cause: "chance",
          effects: [happier(3)],
        });
      }
    }
  }
  return { person: { ...person, education }, events };
}
