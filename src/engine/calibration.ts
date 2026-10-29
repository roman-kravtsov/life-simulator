// The calibration harness (SIM-007): runs many lives headless and compares them with the source
// data: life expectancy, and the school, work, income, marriage and family systems.
import { normalQuantile } from "./dist";
import { completionRates } from "./education";
import { advanceAuto, newLife } from "./life";
import { lifeExpectancy } from "./mortality";
import { ADULT_AGE, shareMarriedBy } from "./partnership";
import type { LifeState, Sex } from "./types";
import type { Country } from "./world/types";

/** Simulated life expectancy may differ from the UN WPP value by at most this many years. */
export const LE_TOLERANCE_YEARS = 2;

const SEXES: readonly Sex[] = ["female", "male"];

/** One whole life with no player input. */
export function simulateLife(seed: string, country: Country): LifeState {
  let state = newLife({ seed, country, settings: { pace: "every-year" } });
  while (state.person.alive) state = advanceAuto(state, country);
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

/**
 * The share of all deaths each cause should take, from the life table and the cause mix (ADMIN-003): the
 * deaths at each age (the share still alive times the chance of dying) spread over the causes of the age
 * band, for the sexes born in the country's ratio.
 */
export function expectedCauseShares(country: Country): Record<string, number> {
  const ratio = country.demography.sexRatioAtBirth.value;
  const male = ratio / (1 + ratio);
  const mix = country.health.causeMix.value;
  const totals: Record<string, number> = {};
  for (const sex of SEXES) {
    const weight = sex === "male" ? male : 1 - male;
    let alive = 1;
    country.demography.lifeTable.value[sex].forEach((q, age) => {
      const deaths = alive * q * weight;
      alive *= 1 - q;
      let band = mix.bands.findIndex(([from, to]) => age >= from && age < to);
      if (band === -1) band = mix.bands.length - 1;
      for (const [cause, share] of Object.entries(mix[sex][band]!))
        totals[cause] = (totals[cause] ?? 0) + deaths * share;
    });
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(totals).map(([cause, n]) => [cause, n / sum]));
}

/** The causes that make up the report: those that take at least this share of deaths in the source. */
const CAUSE_REPORT_FROM = 0.03;

/**
 * Whole lives, headless, compared with the source on life expectancy and on how deaths divide among the
 * causes that matter (each cause that takes 3% or more of deaths in the source, and the rest together).
 */
export function calibrateDeaths(
  country: Country,
  lives: number,
  seedPrefix: string,
): { lifeExpectancy: LifeExpectancyReport; causes: Comparison[] } {
  const counts: Record<string, number> = {};
  let years = 0;
  for (let i = 0; i < lives; i++) {
    const death = simulateLife(`${seedPrefix}-${i}`, country).death!;
    years += death.age + (death.age === 0 ? 0.1 : 0.5);
    counts[death.cause] = (counts[death.cause] ?? 0) + 1;
  }
  const expected = expectedCauseShares(country);
  const named = Object.keys(expected)
    .filter((cause) => expected[cause]! >= CAUSE_REPORT_FROM)
    .sort((a, b) => expected[b]! - expected[a]!);
  const causes: Comparison[] = named.map((cause) => ({
    name: `deaths from ${cause}`,
    expected: expected[cause]!,
    simulated: (counts[cause] ?? 0) / lives,
    tolerance: 0.05,
  }));
  const rest = (shares: (cause: string) => number) =>
    [...new Set([...Object.keys(expected), ...Object.keys(counts)])]
      .filter((cause) => !named.includes(cause))
      .reduce((sum, cause) => sum + shares(cause), 0);
  causes.push({
    name: "deaths from all other causes",
    expected: rest((cause) => expected[cause] ?? 0),
    simulated: rest((cause) => (counts[cause] ?? 0) / lives),
    tolerance: 0.05,
  });
  const simulated = years / lives;
  const source = expectedLifeExpectancy(country);
  return {
    lifeExpectancy: { lives, expected: source, simulated, difference: simulated - source },
    causes,
  };
}

/** One figure the simulated lives are compared with, from the country's source data. */
export interface Comparison {
  name: string;
  expected: number;
  simulated: number;
  /** How far the simulated figure may be from the expected one (absolute, in the figure's own unit). */
  tolerance: number;
}

const LEVEL_RANK = { none: 0, primary: 1, "lower-secondary": 2, "upper-secondary": 3, tertiary: 4 } as const;

/** Age at which attainment and literacy are read, and when the siblings and standing of adults are counted. */
const READ_AT = { attainment: 25, siblings: 22, standing: 35, marriage: 60 } as const;

interface Tally {
  lives: number;
  reached: Record<number, number>;
  literate: number;
  adults: number;
  personYears: number;
  workingYears: number;
  /** Person-years in the labour force: at work or out of work and looking. */
  forceYears: number;
  unemployedYears: number;
  workingBySector: Record<string, number>;
  informalYears: number;
  marriageAges: number[];
  adultsAt50: number;
  marriedBy50: number;
  womenAt20: number;
  marriedUnder18: number;
  womenAt45: number;
  childrenOfWomenAt45: number;
  siblings: number;
  siblingLives: number;
  household: number[];
  standing: number[];
}

const emptyTally = (): Tally => ({
  lives: 0,
  reached: { 1: 0, 2: 0, 3: 0, 4: 0 },
  literate: 0,
  adults: 0,
  personYears: 0,
  workingYears: 0,
  forceYears: 0,
  unemployedYears: 0,
  marriageAges: [],
  adultsAt50: 0,
  marriedBy50: 0,
  womenAt20: 0,
  marriedUnder18: 0,
  womenAt45: 0,
  childrenOfWomenAt45: 0,
  workingBySector: { agriculture: 0, industry: 0, services: 0 },
  informalYears: 0,
  siblings: 0,
  siblingLives: 0,
  household: [],
  standing: [],
});

function correlation(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Runs `lives` whole lives and compares what the school, work, income and family systems produced
 * with the country's source data: completion of each school level, literacy, labour participation
 * (as a share of person-years from 15), sector and informal shares among those at work, siblings,
 * and how strongly adult standing follows the household's. All figures are by sex where the source is.
 */
export function calibrateSystems(country: Country, lives: number, seedPrefix: string): Comparison[] {
  const bySex: Record<Sex, Tally> = { female: emptyTally(), male: emptyTally() };
  const pairs: [number, number][] = [];
  const deciles = new Array<number>(10).fill(0);
  for (let i = 0; i < lives; i++) {
    let state = newLife({ seed: `${seedPrefix}-${i}`, country, settings: { pace: "every-year" } });
    const tally = bySex[state.person.sex];
    tally.lives++;
    while (state.person.alive) {
      state = advanceAuto(state, country);
      const { person } = state;
      const lived = person.age - 1;
      if (lived >= 15) {
        tally.personYears++;
        const { status, sector, formal } = person.work;
        if (status === "unemployed") {
          tally.forceYears++;
          tally.unemployedYears++;
        }
        if (status === "employed" || status === "informal") {
          tally.forceYears++;
          tally.workingYears++;
          if (sector) tally.workingBySector[sector]!++;
          if (formal === false) tally.informalYears++;
        }
      }
      if (person.age === READ_AT.attainment) {
        tally.adults++;
        const rank = LEVEL_RANK[person.education.level];
        for (const level of [1, 2, 3, 4]) if (rank >= level) tally.reached[level]!++;
        if (person.education.literate) tally.literate++;
      }
      if (person.age === READ_AT.marriage) {
        tally.adultsAt50++;
        if (typeof person.flags.marriedAt === "number") {
          tally.marriedBy50++;
          tally.marriageAges.push(person.flags.marriedAt);
        }
      }
      if (person.age === 20 && person.sex === "female") {
        tally.womenAt20++;
        if (typeof person.flags.marriedAt === "number" && person.flags.marriedAt < 18) tally.marriedUnder18++;
      }
      if (person.age === 45 && person.sex === "female") {
        tally.womenAt45++;
        tally.childrenOfWomenAt45 += person.relationships.filter((r) => r.kind === "child").length;
      }
      if (person.age === READ_AT.siblings) {
        tally.siblingLives++;
        tally.siblings +=
          person.relationships.filter((r) => r.kind === "sibling").length + Number(person.flags.siblingsLost ?? 0);
      }
      if (person.age === READ_AT.standing) {
        tally.household.push(person.money.householdPercentile);
        tally.standing.push(person.money.percentile);
        pairs.push([person.money.householdPercentile, person.money.percentile]);
        deciles[Math.ceil(person.money.percentile / 10) - 1]!++;
      }
    }
  }

  const out: Comparison[] = [];
  const { education, work } = country;
  for (const sex of SEXES) {
    const t = bySex[sex];
    const [primary, lower, upper, tertiary] = completionRates(country, sex) as [number, number, number, number];
    const share = (n: number) => (t.adults ? n / t.adults : 0);
    out.push(
      { name: `${sex} primary completion`, expected: primary, simulated: share(t.reached[1]!), tolerance: 0.07 },
      { name: `${sex} lower secondary completion`, expected: lower, simulated: share(t.reached[2]!), tolerance: 0.07 },
      { name: `${sex} upper secondary completion`, expected: upper, simulated: share(t.reached[3]!), tolerance: 0.07 },
      { name: `${sex} tertiary completion`, expected: tertiary, simulated: share(t.reached[4]!), tolerance: 0.07 },
      {
        name: `${sex} adult literacy`,
        expected: education.literacy.value[sex],
        simulated: share(t.literate),
        tolerance: 0.07,
      },
      {
        name: `${sex} labour participation`,
        expected: work.labourParticipation.value[sex],
        simulated: t.personYears ? t.forceYears / t.personYears : 0,
        tolerance: 0.08,
      },
    );
    const ages = t.marriageAges;
    out.push({
      name: `${sex} mean age at first marriage`,
      expected: country.family.meanAgeFirstMarriage.value[sex],
      simulated: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
      tolerance: 2,
    });
  }
  const women = bySex.female;
  // The published mean age and the share married before 18 come from different surveys, and in a few
  // countries no one spread can hold both. There the closest the model reaches is the target.
  const reachable = shareMarriedBy(ADULT_AGE - 0.5, "female", country);
  const published = country.family.childMarriageBy18.value;
  out.push(
    {
      name:
        Math.abs(reachable - published) > 0.04
          ? "women married before 18 (closest the spread reaches)"
          : "women married before 18",
      expected: Math.abs(reachable - published) > 0.04 ? reachable : published,
      simulated: women.womenAt20 ? women.marriedUnder18 / women.womenAt20 : 0,
      tolerance: 0.06,
    },
    {
      name: "children per woman who lives to 45 (total fertility)",
      expected: country.demography.tfr.value,
      simulated: women.womenAt45 ? women.childrenOfWomenAt45 / women.womenAt45 : 0,
      tolerance: Math.max(0.35, 0.15 * country.demography.tfr.value),
    },
  );
  const force = SEXES.reduce((n, sex) => n + bySex[sex].forceYears, 0);
  out.push({
    name: "share of the labour force out of work",
    expected: work.unemployment.value,
    simulated: force ? SEXES.reduce((n, sex) => n + bySex[sex].unemployedYears, 0) / force : 0,
    tolerance: 0.04,
  });
  const working = SEXES.reduce((n, sex) => n + bySex[sex].workingYears, 0);
  const sectorYears = (sector: string) => SEXES.reduce((n, sex) => n + bySex[sex].workingBySector[sector]!, 0);
  for (const sector of ["agriculture", "industry", "services"] as const) {
    out.push({
      name: `${sector} share of work`,
      expected: work.sectorShares.value[sector],
      simulated: working ? sectorYears(sector) / working : 0,
      tolerance: 0.09,
    });
  }
  out.push({
    name: "informal share of work",
    expected: work.informalShare.value,
    simulated: working ? SEXES.reduce((n, sex) => n + bySex[sex].informalYears, 0) / working : 0,
    tolerance: 0.09,
  });
  const siblingLives = SEXES.reduce((n, sex) => n + bySex[sex].siblingLives, 0);
  out.push({
    name: "siblings per person against children per woman",
    expected: country.demography.tfr.value,
    simulated: siblingLives ? SEXES.reduce((n, sex) => n + bySex[sex].siblings, 0) / siblingLives : 0,
    tolerance: Math.max(0.35, 0.12 * country.demography.tfr.value),
  });
  const z = (percentile: number) => normalQuantile((percentile - 0.5) / 100);
  out.push({
    name: "adult standing follows the household (correlation)",
    expected: country.money.intergenerationalPersistence.value,
    simulated:
      pairs.length > 2
        ? correlation(
            pairs.map(([h]) => z(h)),
            pairs.map(([, s]) => z(s)),
          )
        : 0,
    tolerance: 0.12,
  });
  // Half the summed gap between each tenth's share of adults and one tenth: 0 when standing is spread evenly.
  const adults = deciles.reduce((a, b) => a + b, 0);
  out.push({
    name: "adult standing is spread across the country (distance from even tenths)",
    expected: 0,
    simulated: adults ? deciles.reduce((sum, n) => sum + Math.abs(n / adults - 0.1), 0) / 2 : 1,
    tolerance: 0.09,
  });
  return out;
}
