// The calibration harness (SIM-007): runs many lives headless and compares them with the source
// data: life expectancy, and the school, work, income and family systems of M4. Marriage age
// joins with relationships in M5.
import { normalQuantile } from "./dist";
import { advance, newLife } from "./life";
import { lifeExpectancy } from "./mortality";
import type { LifeState, Sex } from "./types";
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

/** One figure the simulated lives are compared with, from the country's source data. */
export interface Comparison {
  name: string;
  expected: number;
  simulated: number;
  /** How far the simulated figure may be from the expected one (absolute, in the figure's own unit). */
  tolerance: number;
}

const SEXES: readonly Sex[] = ["female", "male"];
const LEVEL_RANK = { none: 0, primary: 1, "lower-secondary": 2, "upper-secondary": 3, tertiary: 4 } as const;

/** Age at which attainment and literacy are read, and when the siblings and standing of adults are counted. */
const READ_AT = { attainment: 25, siblings: 22, standing: 35 } as const;

interface Tally {
  lives: number;
  reached: Record<number, number>;
  literate: number;
  adults: number;
  personYears: number;
  workingYears: number;
  workingBySector: Record<string, number>;
  informalYears: number;
  siblings: number;
  siblingLives: number;
  household: number[];
  standing: number[];
}

const emptyTally = (): Tally => ({
  lives: 0,
  reached: { 1: 0, 2: 0, 3: 0 },
  literate: 0,
  adults: 0,
  personYears: 0,
  workingYears: 0,
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
    let state = newLife({ seed: `${seedPrefix}-${i}`, country });
    const tally = bySex[state.person.sex];
    tally.lives++;
    while (state.person.alive) {
      state = advance(state, { kind: "continue" }, country).state;
      const { person } = state;
      const lived = person.age - 1;
      if (lived >= 15) {
        tally.personYears++;
        const { status, sector, formal } = person.work;
        if (status === "employed" || status === "informal") {
          tally.workingYears++;
          if (sector) tally.workingBySector[sector]!++;
          if (formal === false) tally.informalYears++;
        }
      }
      if (person.age === READ_AT.attainment) {
        tally.adults++;
        const rank = LEVEL_RANK[person.education.level];
        for (const level of [1, 2, 3]) if (rank >= level) tally.reached[level]!++;
        if (person.education.literate) tally.literate++;
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
  const cap = (x: number) => Math.min(1, Math.max(0, x));
  for (const sex of SEXES) {
    const t = bySex[sex];
    const primary = cap(education.primaryCompletion.value[sex]);
    const lower = Math.min(primary, cap(education.lowerSecondaryCompletion.value[sex]));
    const upper = Math.min(lower, cap(education.upperSecondaryCompletion.value[sex]));
    const share = (n: number) => (t.adults ? n / t.adults : 0);
    out.push(
      { name: `${sex} primary completion`, expected: primary, simulated: share(t.reached[1]!), tolerance: 0.07 },
      { name: `${sex} lower secondary completion`, expected: lower, simulated: share(t.reached[2]!), tolerance: 0.07 },
      { name: `${sex} upper secondary completion`, expected: upper, simulated: share(t.reached[3]!), tolerance: 0.07 },
      {
        name: `${sex} adult literacy`,
        expected: education.literacy.value[sex],
        simulated: share(t.literate),
        tolerance: 0.07,
      },
      {
        name: `${sex} labour participation`,
        expected: work.labourParticipation.value[sex],
        simulated: t.personYears ? t.workingYears / t.personYears : 0,
        tolerance: 0.08,
      },
    );
  }
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
