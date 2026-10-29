// Work (CAREER-001, CAREER-002, CAREER-006). Everyone is dealt a fixed "attachment" between 0 and 1
// at birth. Out of school, a person works at the ages where the country's participation rate for
// their sex is above their attachment. So a country's participation rate holds for its people, an
// individual's working life has one shape (in, perhaps out for a while, in again, out at the end),
// and nobody flickers between jobs from one year to the next. The first job, its sector and whether
// it is formal, is drawn once. A worker may lose the job and spend a spell unemployed (CAREER-003);
// job changes arrive with CAREER-005.
import { clamp } from "./dist";
import { attainmentShares, inSchoolShare, literacyChance } from "./education";
import { FOCUS_EFFECT } from "./focus";
import type { PendingEvent } from "./events";
import type { Rng } from "./rng";
import type { EducationLevel, Person, Sector, Sex, WorkStatus } from "./types";
import type { Country } from "./world/types";

export const WORKING_AGE = 15;
/** Out of the labour force at this age, a person counts as retired whatever their history. */
export const RETIREMENT_AGE = 65;
/** Out of the labour force from this age, someone who has worked counts as retired. */
export const EARLY_RETIREMENT_AGE = 55;
/** Below this health, from age 45, a person stops working. */
const FAILING_HEALTH = 25;
const MAX_PARTICIPATION = 0.97;

/** The shape of working life by age as a share of the prime-age rate: [age, share], linear in between. */
const ENTRY_CURVE: readonly (readonly [number, number])[] = [
  [15, 0.3],
  [18, 0.6],
  [22, 0.9],
  [25, 1],
];
/** Where participation starts to fall, before the country's informal share pushes it later. */
const DECLINE_FROM = 55;
/** Years later the decline starts where all work is informal: people without a pension keep working. */
const INFORMAL_DELAY = 8;
const DECLINE_YEARS = 22;
const OLD_AGE_FLOOR = 0.04;

function shape(age: number, country: Country): number {
  if (age < WORKING_AGE) return 0;
  if (age <= 25) {
    for (let i = 1; i < ENTRY_CURVE.length; i++) {
      const [x1, y1] = ENTRY_CURVE[i]!;
      if (age <= x1) {
        const [x0, y0] = ENTRY_CURVE[i - 1]!;
        return y0 + ((y1 - y0) * (age - x0)) / (x1 - x0);
      }
    }
  }
  const declineFrom = DECLINE_FROM + INFORMAL_DELAY * country.work.informalShare.value;
  if (age <= declineFrom) return 1;
  return Math.max(OLD_AGE_FLOOR, 1 - ((1 - OLD_AGE_FLOOR) * (age - declineFrom)) / DECLINE_YEARS);
}

// Sector odds and informal odds are logistic models with the weights below (authored). Their
// intercepts are solved per country so the average over its people matches the published shares.
/** Log-weight on living in the countryside, then per level of schooling (0 none to 4 tertiary). */
const SECTOR_WEIGHTS: Record<Sector, { rural: number; schooling: number }> = {
  agriculture: { rural: 1, schooling: -0.45 },
  industry: { rural: -0.2, schooling: 0.1 },
  services: { rural: -0.8, schooling: 0.35 },
};
const INFORMAL_BY_SECTOR: Record<Sector, number> = { agriculture: 1.2, industry: 0, services: -0.6 };
const INFORMAL_SCHOOLING = -0.4;
const INFORMAL_RURAL = 0.3;
/** Someone who cannot read is far less likely to be taken on formally (EDU-002). */
const INFORMAL_ILLITERATE = 1;

const SECTORS: readonly Sector[] = ["agriculture", "industry", "services"];
const LEVELS_IN_ORDER: readonly EducationLevel[] = [
  "none",
  "primary",
  "lower-secondary",
  "upper-secondary",
  "tertiary",
];
const schoolingIndex = (level: EducationLevel) => LEVELS_IN_ORDER.indexOf(level);

const logistic = (x: number) => 1 / (1 + Math.exp(-x));

interface Cell {
  weight: number;
  rural: boolean;
  schooling: number;
}

/** The country's people by place and schooling, for one sex. */
function cells(country: Country, sex: Sex): Cell[] {
  const shares = attainmentShares(country, sex);
  const urbanShare = country.demography.urbanShare.value;
  return LEVELS_IN_ORDER.flatMap((level, schooling) =>
    [true, false].map((rural) => ({
      weight: shares[level] * (rural ? 1 - urbanShare : urbanShare),
      rural,
      schooling,
    })),
  );
}

function sectorProbabilities(
  offsets: Record<Sector, number>,
  rural: boolean,
  schooling: number,
): Record<Sector, number> {
  const weights = SECTORS.map((s) =>
    Math.exp(offsets[s] + SECTOR_WEIGHTS[s].rural * (rural ? 1 : 0) + SECTOR_WEIGHTS[s].schooling * schooling),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  return Object.fromEntries(SECTORS.map((s, i) => [s, weights[i]! / total])) as Record<Sector, number>;
}

const informalLogit = (intercept: number, sector: Sector, rural: boolean, schooling: number, literate: boolean) =>
  intercept +
  INFORMAL_BY_SECTOR[sector] +
  INFORMAL_SCHOOLING * schooling +
  INFORMAL_RURAL * (rural ? 1 : 0) +
  (literate ? 0 : INFORMAL_ILLITERATE);

interface WorkModel {
  /** Multiplies the shape of working life so the country's participation rate holds. */
  participationScale: number;
  sectorOffsets: Record<Sector, number>;
  informalIntercept: number;
}

function buildModel(country: Country, sex: Sex): WorkModel {
  // Participation: out of school and by the survivorship of a life table, which is who a batch of lives contains.
  const table = country.demography.lifeTable.value[sex];
  let alive = 1;
  const weight: number[] = [];
  for (let age = 0; age < table.length; age++) {
    weight[age] = alive;
    alive *= 1 - table[age]!;
  }
  const target = clamp(country.work.labourParticipation.value[sex], 0, 1);
  let total = 0;
  for (let age = WORKING_AGE; age < weight.length; age++) total += weight[age]!;
  const rate = (scale: number) => {
    let sum = 0;
    for (let age = WORKING_AGE; age < weight.length; age++) {
      sum +=
        weight[age]! *
        (1 - inSchoolShare(country, sex, age)) *
        Math.min(MAX_PARTICIPATION, scale * shape(age, country));
    }
    return sum / total;
  };
  let low = 0;
  let high = 40;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (rate(mid) < target) low = mid;
    else high = mid;
  }
  const participationScale = (low + high) / 2;

  // Sector: shift each sector's log-weight until the average over the country's people matches its share.
  const people = cells(country, sex);
  const shares = country.work.sectorShares.value;
  const sum = SECTORS.reduce((s, k) => s + shares[k], 0);
  const wanted = Object.fromEntries(SECTORS.map((s) => [s, Math.max(1e-6, shares[s] / sum)])) as Record<Sector, number>;
  const sectorOffsets = Object.fromEntries(SECTORS.map((s) => [s, Math.log(wanted[s])])) as Record<Sector, number>;
  for (let round = 0; round < 200; round++) {
    const mean = { agriculture: 0, industry: 0, services: 0 };
    for (const c of people) {
      const p = sectorProbabilities(sectorOffsets, c.rural, c.schooling);
      for (const s of SECTORS) mean[s] += c.weight * p[s];
    }
    for (const s of SECTORS) sectorOffsets[s] += Math.log(wanted[s] / Math.max(mean[s], 1e-12));
  }

  // Informal work: one intercept so the average informal share over workers matches the country.
  const informal = clamp(country.work.informalShare.value, 0.001, 0.999);
  const informalMean = (intercept: number) => {
    let sum = 0;
    for (const c of people) {
      const p = sectorProbabilities(sectorOffsets, c.rural, c.schooling);
      const reads = literacyChance(sex, country, c.schooling > 0);
      for (const s of SECTORS) {
        sum +=
          c.weight *
          p[s] *
          (reads * logistic(informalLogit(intercept, s, c.rural, c.schooling, true)) +
            (1 - reads) * logistic(informalLogit(intercept, s, c.rural, c.schooling, false)));
      }
    }
    return sum;
  };
  let lo = -30;
  let hi = 30;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (informalMean(mid) < informal) lo = mid;
    else hi = mid;
  }
  return { participationScale, sectorOffsets, informalIntercept: (lo + hi) / 2 };
}

const models = new WeakMap<Country, Map<Sex, WorkModel>>();

function modelFor(country: Country, sex: Sex): WorkModel {
  let bySex = models.get(country);
  if (!bySex) models.set(country, (bySex = new Map()));
  let model = bySex.get(sex);
  if (!model) bySex.set(sex, (model = buildModel(country, sex)));
  return model;
}

/** The chance that someone not in school is in the labour force at `age`. */
export function participationRate(sex: Sex, age: number, country: Country): number {
  return Math.min(MAX_PARTICIPATION, modelFor(country, sex).participationScale * shape(age, country));
}

/** Where a person with this schooling and place would work, as odds that add up to one. */
export function sectorOdds(person: Person, country: Country): Record<Sector, number> {
  return sectorProbabilities(
    modelFor(country, person.sex).sectorOffsets,
    person.location === "rural",
    schoolingIndex(person.education.level),
  );
}

/** The chance a job in `sector` is informal for this person. */
export function informalOdds(person: Person, sector: Sector, country: Country): number {
  return logistic(
    informalLogit(
      modelFor(country, person.sex).informalIntercept,
      sector,
      person.location === "rural",
      schoolingIndex(person.education.level),
      person.education.literate !== false,
    ),
  );
}

/** Health points a person's job costs each year, by how risky the work is (WORLD-009). Zero when not working. */
export function jobHealthPenalty(person: Person): number {
  const { status, sector, formal } = person.work;
  if (status !== "employed" && status !== "informal") return 0;
  const risk = sector === "industry" ? 1.5 : sector === "agriculture" ? 1 : 0;
  return risk + (formal === false ? 1 : 0);
}

export const isWorking = (status: WorkStatus) => status === "employed" || status === "informal";

/** What the person is doing this year: at school, at work, at home or retired. */
export function workStatusFor(person: Person, country: Country): WorkStatus {
  const { age, work, education } = person;
  if (age < 6) return "child";
  if (education.inSchool) return "student";
  if (age < WORKING_AGE) return "child";
  const failing = age >= 45 && person.stats.health < FAILING_HEALTH;
  if (!failing && work.attachment < participationRate(person.sex, age, country)) {
    return work.formal === false ? "informal" : "employed";
  }
  if (age >= RETIREMENT_AGE || (age >= EARLY_RETIREMENT_AGE && work.yearsWorked > 0)) return "retired";
  return age >= 18 ? "caregiver" : "child";
}

export interface WorkStep {
  person: Person;
  events: PendingEvent[];
}

/**
 * The chance an unemployed person finds work within a year. Authored: it makes a spell last about two
 * years, which is what the yearly turn can show. Points on Earn above the default plan (the job
 * search) raise it.
 */
export const FINDING_RATE = 0.45;

const earnUnits = (person: Person) => person.focus?.earn ?? 0;

export function findingChance(person: Person): number {
  return clamp(FINDING_RATE * (1 + FOCUS_EFFECT.earn.finding * earnUnits(person)), 0.05, 0.95);
}

/**
 * The yearly chance a worker loses the job. With spells ending at FINDING_RATE, a loss rate of
 * u x finding / (1 - u) holds the share of the labour force out of work at the country's rate u.
 */
export function jobLossChance(person: Person, country: Country): number {
  const u = clamp(country.work.unemployment.value, 0, 0.6);
  const base = (u * FINDING_RATE) / (1 - u);
  return clamp(base * Math.max(0.3, 1 - FOCUS_EFFECT.earn.losing * earnUnits(person)), 0, 0.9);
}

/**
 * One year of work. A first job is drawn the first year the person is in the labour force.
 * A worker may lose the job, and an unemployed person may find one (CAREER-003): those in the labour
 * force who are not employed count towards unemployment, and a first-time entrant starts out
 * unemployed at the country's rate. Always draws three numbers (sector, formal or informal, the spell).
 */
export function stepWork(person: Person, country: Country, rng: Rng): WorkStep {
  const sectorRoll = rng.next();
  const informalRoll = rng.next();
  const spellRoll = rng.next();
  const events: PendingEvent[] = [];
  let { work } = person;
  const before = work.status;
  let status = workStatusFor(person, country);

  if (isWorking(status)) {
    // In the labour force. Whether the person is at work or between jobs this year:
    if (before === "unemployed") {
      if (spellRoll >= findingChance(person)) status = "unemployed";
    } else if (isWorking(before)) {
      if (spellRoll < jobLossChance(person, country)) status = "unemployed";
    } else if (work.yearsWorked === 0 && work.sector === undefined) {
      if (spellRoll < clamp(country.work.unemployment.value, 0, 0.6)) status = "unemployed";
    }
  }

  if (isWorking(status) && work.sector === undefined) {
    const odds = sectorOdds(person, country);
    let roll = sectorRoll;
    const sector = SECTORS.find((s) => (roll -= odds[s]) < 0) ?? "services";
    const formal = informalRoll >= informalOdds(person, sector, country);
    work = { ...work, sector, formal };
    status = formal ? "employed" : "informal";
    events.push({
      id: "work.starts",
      textKey: `event.work.starts.${sector}.${formal ? "formal" : "informal"}`,
      cause: "circumstance",
      effects: [{ stat: "happiness", add: 1 }],
    });
  } else if (status === "unemployed" && before !== "unemployed") {
    events.push({
      id: "work.job_lost",
      textKey: isWorking(before) ? "event.work.job_lost" : "event.work.no_work_yet",
      cause: "chance",
      effects: [{ stat: "happiness", add: isWorking(before) ? -3 : -1 }],
    });
  } else if (isWorking(status) && before === "unemployed") {
    events.push({
      id: "work.job_found",
      textKey: "event.work.job_found",
      cause: "chance",
      effects: [{ stat: "happiness", add: 3 }],
    });
  } else if (isWorking(before) && !isWorking(status)) {
    events.push(
      status === "retired"
        ? { id: "work.retires", textKey: "event.work.retires", cause: "circumstance", effects: [] }
        : { id: "work.stops", textKey: "event.work.stops", cause: "circumstance", effects: [] },
    );
  }
  if (before === "unemployed" && !isWorking(status) && status !== "unemployed") {
    events.push(
      status === "retired"
        ? { id: "work.retires", textKey: "event.work.retires", cause: "circumstance", effects: [] }
        : { id: "work.stops", textKey: "event.work.stops", cause: "circumstance", effects: [] },
    );
  }
  work = { ...work, status, yearsWorked: work.yearsWorked + (isWorking(status) ? 1 : 0) };
  return { person: { ...person, work }, events };
}
