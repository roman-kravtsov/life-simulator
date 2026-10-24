// Money (MONEY-001 to MONEY-004). The household is placed at a percentile of the country's income
// distribution at birth. From adulthood the person's own percentile mixes the household's (as
// strongly as the country's intergenerational persistence says), their schooling, skills, job and
// luck. Yearly income is read from the country's table at that percentile, and savings and debt
// follow from income and costs.
import { clamp, normal, normalCdf, normalQuantile } from "./dist";
import { attainmentShares } from "./education";
import type { PendingEvent } from "./events";
import type { Rng } from "./rng";
import type { EducationLevel, Person, Sector } from "./types";
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

/** From this age, and out of school, the person's own standing replaces the household's. */
export const INDEPENDENCE_AGE = 18;

const DAYS = 365;

// The numbers below are modelling choices, not published statistics. They are tuned so the mix keeps
// the whole distribution spread across 1 to 100 and the link to the household near the country's
// persistence (the calibration harness checks both).
/** How much of the country's persistence the household term carries directly; schooling carries the rest. */
const HOUSEHOLD_SHARE = 0.7;
const MIX = { education: 0.5, skills: 0.2, job: 0.15, luck: 0.5 } as const;
/** Standard deviation of the unscaled own-merit mix, so that it has spread 1. */
const MIX_SPREAD = 0.7;
/**
 * Skills mostly follow schooling, so skills count in the mix only as the gap from what the person's
 * level of schooling usually brings (the average at 35 in simulated lives), in steps of SKILLS_SPREAD.
 */
const SKILLS_BY_LEVEL: Record<EducationLevel, number> = {
  none: 43,
  primary: 50,
  "lower-secondary": 54,
  "upper-secondary": 59,
  tertiary: 63,
};
const SKILLS_SPREAD = 8;
const JOB_SECTOR: Record<Sector, number> = { agriculture: -0.3, industry: 0.1, services: 0.3 };
const INFORMAL_JOB = -0.3;

const LEVELS_IN_ORDER: readonly EducationLevel[] = [
  "none",
  "primary",
  "lower-secondary",
  "upper-secondary",
  "tertiary",
];

/** Where the person's schooling stands among their country's people of their sex, as a z-score. */
export function educationScore(person: Person, country: Country): number {
  const shares = attainmentShares(country, person.sex);
  const index = LEVELS_IN_ORDER.indexOf(person.education.level);
  let below = 0;
  for (let i = 0; i < index; i++) below += shares[LEVELS_IN_ORDER[i]!];
  return normalQuantile(below + shares[person.education.level] / 2);
}

function jobScore(person: Person): number {
  const { status, sector, formal } = person.work;
  if ((status !== "employed" && status !== "informal") || !sector) return 0;
  return JOB_SECTOR[sector] + (formal === false ? INFORMAL_JOB : 0);
}

/** The person's own percentile as an adult, 1 to 100. */
export function adultPercentile(person: Person, country: Country): number {
  const household = normalQuantile((person.money.householdPercentile - 0.5) / 100);
  const persistence = clamp(country.money.intergenerationalPersistence.value, 0, 0.95);
  const direct = HOUSEHOLD_SHARE * persistence;
  const merit =
    (MIX.education * educationScore(person, country) +
      MIX.skills * clamp((person.stats.skills - SKILLS_BY_LEVEL[person.education.level]) / SKILLS_SPREAD, -2.5, 2.5) +
      MIX.job * jobScore(person) +
      MIX.luck * person.money.luck) /
    MIX_SPREAD;
  const z = direct * household + Math.sqrt(1 - direct * direct) * merit;
  return clamp(Math.round(normalCdf(z) * 100), 1, 100);
}

/** Where the person stands now: the household's in childhood and school, their own after. */
export const currentPercentile = (person: Person, country: Country): number =>
  person.age < INDEPENDENCE_AGE || person.education.inSchool
    ? person.money.householdPercentile
    : adultPercentile(person, country);

/** Retirement income as a share of the working income at the same percentile (authored; pensions and family support vary). */
const RETIRED_INCOME = 0.7;

/** An adult at home or without a job lives on family support, not earnings (authored). */
const UNEMPLOYED_INCOME = 0.5;

const INCOME_SHARE: Partial<Record<Person["work"]["status"], number>> = {
  retired: RETIRED_INCOME,
  caregiver: UNEMPLOYED_INCOME,
  unemployed: UNEMPLOYED_INCOME,
};

/** What the person's own money brings in a year, in PPP dollars: the table at their percentile, by work status. */
export function yearlyIncome(person: Person, country: Country): number {
  const share = INCOME_SHARE[person.work.status] ?? 1;
  return dailyIncome(country, person.money.percentile) * DAYS * share;
}

/** Yearly interest on debt (authored, a plain real rate). */
const DEBT_INTEREST = 0.06;
/** Share of income spent: just over all of it at the bottom, 78% at the top (authored). */
const SPENDING_AT_BOTTOM = 1.02;
const SPENDING_AT_TOP = 0.78;
/** Spread of a year's spending around its usual share of income. */
const SPENDING_NOISE = 0.06;
/** Debt of this share of a year's income is a heavy weight on mind and body. */
const HEAVY_DEBT = 0.5;

const spendingShare = (percentile: number) =>
  SPENDING_AT_BOTTOM + ((SPENDING_AT_TOP - SPENDING_AT_BOTTOM) * (percentile - 1)) / 99;

/** 0 to 1: how heavily debt weighs, as debt against half a year's income. Zero for a child. */
export function debtStress(person: Person, country: Country): number {
  if (person.age < INDEPENDENCE_AGE || person.money.debt <= 0) return 0;
  const annual = dailyIncome(country, person.money.percentile) * DAYS;
  return clamp(person.money.debt / (HEAVY_DEBT * annual), 0, 1);
}

export interface MoneyStep {
  person: Person;
  events: PendingEvent[];
}

/**
 * One year of money. Children and students keep the household's standing. An independent adult
 * takes their own percentile, earns the table's income there, spends a share of it, pays down debt
 * first and saves what is left, or draws on savings and then borrows. Always draws two numbers.
 */
export function stepMoney(person: Person, country: Country, rng: Rng): MoneyStep {
  const noise = normal(rng, 0, SPENDING_NOISE);
  const percentile = currentPercentile(person, country);
  if (person.age < INDEPENDENCE_AGE || person.education.inSchool) {
    return { person: { ...person, money: { ...person.money, percentile } }, events: [] };
  }
  const standing: Person = { ...person, money: { ...person.money, percentile } };
  const income = yearlyIncome(standing, country);
  const net = income * (1 - spendingShare(percentile) - noise);
  let { savings, debt } = person.money;
  debt *= 1 + DEBT_INTEREST;
  if (net >= 0) {
    const repaid = Math.min(debt, net);
    debt -= repaid;
    savings += net - repaid;
  } else {
    const drawn = Math.min(savings, -net);
    savings -= drawn;
    debt += -net - drawn;
  }
  const next: Person = { ...standing, money: { ...standing.money, savings, debt } };
  const events: PendingEvent[] = [];
  const pressured = debtStress(next, country) >= 1;
  const wasPressured = person.flags.debtPressure === true;
  let flags = next.flags;
  if (pressured && !wasPressured) {
    flags = { ...flags, debtPressure: true };
    events.push({
      id: "money.debt_pressure",
      textKey: "event.money.debt_pressure",
      cause: "circumstance",
      effects: [{ stat: "happiness", add: -2 }],
    });
  } else if (wasPressured && debt <= 0) {
    flags = { ...flags, debtPressure: false };
    events.push({
      id: "money.debt_cleared",
      textKey: "event.money.debt_cleared",
      cause: "circumstance",
      effects: [{ stat: "happiness", add: 3 }],
    });
  }
  return { person: { ...next, flags }, events };
}
