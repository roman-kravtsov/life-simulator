// Health conditions: chronic illnesses and injuries with a severity from 1 to 3 (HEALTH-004). A
// condition begins by a yearly chance that depends on age, household, place, job and how common its
// cause is in the country's deaths; once the person has it, each year it may worsen or ease. It lowers
// the health the person drifts toward, raises the hazard of death, shifts the cause of death, and can
// take focus points from the yearly plan (used from M5). The conditions are content (src/content/
// healthConditions.ts); this file holds the rules. All onset chances are authored for plausibility,
// not published statistics, so nothing here is shown to the player as a fact about a country.
import { clamp } from "./dist";
import type { Effect } from "./effects";
import { FOCUS_EFFECT } from "./focus";
import { dailyIncome, yearlyIncome } from "./money";
import type { PendingEvent } from "./events";
import type { Rng } from "./rng";
import type { CauseId, HealthCondition, HelpTopic, Person, Sector, Sensitivity, Sex } from "./types";
import type { Country } from "./world/types";

export interface ConditionDef {
  /** Dotted and stable, such as "hypertension". Strings use it: condition.<id> and event.condition.<id>.begins, .worsens, .ends. */
  id: string;
  /** Ages at which it can begin, inclusive. */
  ages: [number, number];
  /** Yearly chance of beginning at the curve's reference level, for a person with no extra risk. */
  onset: number;
  /** [age, factor] pairs, linear in between: how onset changes with age. */
  ageCurve?: [number, number][];
  /** Risk ratio for the poorest compared with the middle (the richest get its inverse). */
  poverty?: number;
  /** Risk ratio for the countryside compared with towns. */
  rural?: number;
  /** Risk ratio by sector of a person who works. */
  jobs?: Partial<Record<Sector, number>>;
  /** Scales onset by this cause's share of the country's deaths against a reference share. */
  causeShare?: { cause: CauseId; reference: number };
  /** The cause of death it makes likelier. */
  raises?: CauseId;
  /** Yearly chance of getting a severity worse, below 3. */
  worsen: number;
  /** Yearly chance of getting a severity better, ending it at 1. */
  recover: number;
  /** Added to the log hazard of death for each point of severity. */
  hazard: number;
  /** Subtracted from the health the person drifts toward, for each point of severity. */
  healthPenalty: number;
  /** Focus points a year it takes from the plan at severity 1, 2 and 3. */
  focusCost: [number, number, number];
  sensitivity?: Sensitivity;
  helpTopic?: HelpTopic;
  /**
   * What a course of treatment costs, as a share of a year of the income of someone in the middle of the
   * country, for the usual care and for the best care, before the country's out-of-pocket share is
   * applied (HEALTH-005, MONEY-005). Authored. Absent: nothing to be done but wait.
   */
  care?: { usual: number; best: number };
}

export interface ConditionCatalog {
  all: readonly ConditionDef[];
  get(id: string): ConditionDef | undefined;
}

export function createConditionCatalog(defs: readonly ConditionDef[]): ConditionCatalog {
  const byId = new Map<string, ConditionDef>();
  for (const def of defs) {
    if (byId.has(def.id)) throw new Error(`Duplicate condition id: ${def.id}`);
    if (!(def.ages[0] <= def.ages[1])) throw new Error(`Condition ${def.id}: ages must run from low to high`);
    for (const p of [def.onset, def.worsen, def.recover]) {
      if (!(p >= 0 && p <= 1)) throw new Error(`Condition ${def.id}: each chance must be between 0 and 1`);
    }
    byId.set(def.id, def);
  }
  return { all: defs, get: (id) => byId.get(id) };
}

/** How well a condition is looked after: -1 left alone, 0 the usual care (what the life table already contains), 1 the best. */
export type CareLevel = -1 | 0 | 1;

export const careLevel = (person: Pick<Person, "flags">, id: string): CareLevel => {
  const level = person.flags[`care.${id}`];
  return level === 1 || level === -1 ? level : 0;
};

/**
 * What care does to a condition's course. The usual care changes nothing: the calibration (and the life
 * table behind it) assumes it. Best care halves the chance of getting worse and makes getting better
 * likelier; doing nothing does the opposite. Authored.
 */
const CARE_EFFECT: Record<CareLevel, { worsen: number; recover: number; hazard: number }> = {
  [-1]: { worsen: 1.5, recover: 0.6, hazard: 1.25 },
  0: { worsen: 1, recover: 1, hazard: 1 },
  1: { worsen: 0.5, recover: 1.5, hazard: 0.8 },
};

/** The yearly chances of a condition at `severity` getting worse and getting better, with this care. The odds lens shows these. */
export function conditionOdds(
  def: ConditionDef,
  severity: number,
  level: CareLevel,
): { worsen: number; recover: number } {
  const worsen = severity < 3 ? clamp(def.worsen * CARE_EFFECT[level].worsen, 0, 1) : 0;
  return { worsen, recover: Math.min(clamp(def.recover * CARE_EFFECT[level].recover, 0, 1), 1 - worsen) };
}

/**
 * A typical out-of-pocket share of health spending (authored reference): a country that pays this much
 * out of pocket sees the base costs; one that pays more, or less, sees them scaled.
 */
export const REFERENCE_OUT_OF_POCKET = 0.3;

/** What a course of care costs the person, in PPP dollars (MONEY-005): scaled by the country's out-of-pocket share. */
export function careCost(def: ConditionDef, kind: "usual" | "best", country: Country): number {
  if (!def.care) return 0;
  const scale = clamp(country.money.healthOutOfPocketShare.value / REFERENCE_OUT_OF_POCKET, 0.2, 2.5);
  return def.care[kind] * dailyIncome(country, 50) * 365 * scale;
}

/** Hazard per severity point for a condition the catalog does not know (the M3 value). */
const UNKNOWN_HAZARD = 0.35;
/** A year's chance of beginning never goes above this, whatever the risks multiply to. */
const MAX_ONSET = 0.5;
/** Most focus points conditions can take in a year. */
const MAX_FOCUS_LOST = 2;

function interpolate(curve: readonly (readonly [number, number])[], x: number): number {
  const first = curve[0]!;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]!;
    if (x <= x1) {
      const [x0, y0] = curve[i - 1]!;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return curve.at(-1)![1];
}

/** Onset chance from age and the country's cause mix alone: what a person with no extra risk faces. */
function baseOnset(def: ConditionDef, age: number, sex: Sex, country: Country): number {
  if (age < def.ages[0] || age > def.ages[1]) return 0;
  let p = def.onset;
  if (def.ageCurve) p *= interpolate(def.ageCurve, age);
  if (def.causeShare) {
    const mix = country.health.causeMix.value;
    let band = mix.bands.findIndex(([from, to]) => age >= from && age < to);
    if (band === -1) band = mix.bands.length - 1;
    p *= clamp((mix[sex][band]?.[def.causeShare.cause] ?? 0) / def.causeShare.reference, 0.1, 3);
  }
  return p;
}

/** How much this person's household, place and job multiply the base chance. */
function riskFactor(def: ConditionDef, person: Person): number {
  let risk = 1;
  if (def.poverty) risk *= def.poverty ** ((50.5 - person.money.percentile) / 49.5);
  if (def.rural && person.location === "rural") risk *= def.rural;
  const { status, sector } = person.work;
  if (def.jobs && sector && (status === "employed" || status === "informal")) risk *= def.jobs[sector] ?? 1;
  return risk;
}

/** The chance the condition begins this year for a person who does not have it. */
export function onsetProbability(def: ConditionDef, person: Person, country: Country): number {
  // Points on Health above the default plan keep illness away; fewer let it in (DEC-003).
  const care = Math.max(0.4, 1 - FOCUS_EFFECT.health.onset * (person.focus?.health ?? 0));
  return Math.min(MAX_ONSET, baseOnset(def, person.age, person.sex, country) * riskFactor(def, person) * care);
}

/** The risk factor averaged over the country's people (jobs left out): poverty over all 100 percentiles and the urban share. */
function meanRisk(def: ConditionDef, country: Country): number {
  let poverty = 1;
  if (def.poverty) {
    poverty = 0;
    for (let percentile = 1; percentile <= 100; percentile++) poverty += def.poverty ** ((50.5 - percentile) / 49.5);
    poverty /= 100;
  }
  const urban = country.demography.urbanShare.value;
  return poverty * (def.rural ? urban + (1 - urban) * def.rural : 1);
}

/**
 * How much more the conditions a person of this age and sex carries raise the average hazard of death
 * in the country, as the mean of exp(hazard) over living people. Mortality divides it out so that
 * conditions decide who among people of one age dies, not how many do (the life table decides that).
 * Prevalence comes from a cohort model of the conditions, one at a time and independent of each other,
 * that follows onset, worsening and easing with age and thins out the sick by their higher hazard.
 */
export function expectedHazardFactor(country: Country, sex: Sex, age: number, catalog: ConditionCatalog): number {
  return factorsFor(country, sex, catalog)[Math.min(age, MAX_MODEL_AGE)]!;
}

const MAX_MODEL_AGE = 100;
const factorCache = new WeakMap<Country, WeakMap<ConditionCatalog, Map<Sex, number[]>>>();

function factorsFor(country: Country, sex: Sex, catalog: ConditionCatalog): number[] {
  let byCatalog = factorCache.get(country);
  if (!byCatalog) factorCache.set(country, (byCatalog = new WeakMap()));
  let bySex = byCatalog.get(catalog);
  if (!bySex) byCatalog.set(catalog, (bySex = new Map()));
  let factors = bySex.get(sex);
  if (!factors) bySex.set(sex, (factors = buildFactors(country, sex, catalog)));
  return factors;
}

function buildFactors(country: Country, sex: Sex, catalog: ConditionCatalog): number[] {
  const table = country.demography.lifeTable.value[sex];
  const factors = new Array<number>(MAX_MODEL_AGE + 1).fill(1);
  for (const def of catalog.all) {
    const risk = meanRisk(def, country);
    // Share of the living in each state: no condition, severity 1, 2, 3.
    let state = [1, 0, 0, 0];
    for (let age = 0; age <= MAX_MODEL_AGE; age++) {
      factors[age]! *= state[0]! + [1, 2, 3].reduce((sum, v) => sum + state[v]! * Math.exp(def.hazard * v), 0);
      const q = table[Math.min(age, table.length - 1)]!;
      const onset = Math.min(MAX_ONSET, baseOnset(def, age, sex, country) * risk);
      const next = [0, 0, 0, 0];
      for (let v = 0; v <= 3; v++) {
        const live =
          state[v]! * (v === 0 ? 1 : (1 - Math.min(1, q * Math.exp(def.hazard * v))) / Math.max(1e-9, 1 - q));
        if (v === 0) {
          next[0]! += live * (1 - onset);
          next[1]! += live * onset;
        } else {
          const up = v < 3 ? def.worsen : 0;
          const down = Math.min(def.recover, 1 - up);
          next[Math.min(3, v + 1)]! += live * up;
          next[v - 1]! += live * down;
          next[v]! += live * (1 - up - down);
        }
      }
      const total = next.reduce((a, b) => a + b, 0);
      state = next.map((x) => x / total);
    }
  }
  return factors;
}

/** Added to the log hazard of death by all the person's conditions, each as well looked after as the person has seen to. */
export const conditionHazard = (
  conditions: readonly HealthCondition[],
  catalog: ConditionCatalog,
  flags: Person["flags"] = {},
): number =>
  conditions.reduce(
    (sum, c) =>
      sum + (catalog.get(c.id)?.hazard ?? UNKNOWN_HAZARD) * c.severity * CARE_EFFECT[careLevel({ flags }, c.id)].hazard,
    0,
  );

/** Taken from the health the person drifts toward. */
export const healthPenalty = (conditions: readonly HealthCondition[], catalog: ConditionCatalog): number =>
  conditions.reduce((sum, c) => sum + (catalog.get(c.id)?.healthPenalty ?? 0) * c.severity, 0);

/** Focus points the person's conditions take from the yearly plan, at most two (the plan arrives in M5). */
export const focusPointsLost = (conditions: readonly HealthCondition[], catalog: ConditionCatalog): number =>
  Math.min(
    MAX_FOCUS_LOST,
    conditions.reduce((sum, c) => sum + (catalog.get(c.id)?.focusCost[c.severity - 1] ?? 0), 0),
  );

export interface ConditionStep {
  person: Person;
  events: PendingEvent[];
}

const asSeverity = (n: number) => clamp(n, 1, 3) as HealthCondition["severity"];

export const CARE_DECISION = "health.seek_care";

/** From this age the person is asked how to see to a serious condition; before it the household does. */
export const CARE_ASK_AGE = 12;

/** The cost of the usual care as a share of the person's own year of income (a cost effect takes a share). */
export function careShare(def: ConditionDef, kind: "usual" | "best", person: Person, country: Country): number {
  return careCost(def, kind, country) / yearlyIncome(person, country);
}

/**
 * One year of conditions. Each condition in the catalog draws one number from its own stream
 * (`rollFor(id)`), so adding a condition never shifts another's roll: for one the person does not have, the
 * roll is its onset; for one they have, a low roll worsens it and a high roll eases it. When one begins, or
 * gets serious (severity 2 or more), and the year has room for a decision (`open`), the person is asked how
 * to see to it (HEALTH-005); otherwise they get the usual care, which costs but changes nothing in the odds.
 */
export function stepConditions(
  person: Person,
  country: Country,
  rollFor: (id: string) => Rng,
  catalog: ConditionCatalog,
  { open = false }: { open?: boolean } = {},
): ConditionStep {
  const events: PendingEvent[] = [];
  let conditions = person.conditions;
  // Until this age the household decides on care; the person has no say.
  let asked = !open || person.age < CARE_ASK_AGE;
  const event = (def: ConditionDef, id: string, textKey: string, effects: Effect[]) => {
    const pending: PendingEvent = { id: `health.${def.id}.${id}`, textKey, cause: "chance", effects };
    if (def.sensitivity) pending.sensitivity = def.sensitivity;
    if (def.helpTopic) pending.helpTopic = def.helpTopic;
    events.push(pending);
  };
  /** The care a condition needs: a question when it is serious and the year has room, the usual care otherwise. */
  const seeToIt = (def: ConditionDef, serious: boolean) => {
    if (!def.care) return;
    if (asked || !serious) {
      const share = careShare(def, "usual", person, country);
      events.push({
        id: `health.${def.id}.care`,
        textKey: "event.health.usual_care",
        cause: "circumstance",
        effects: [
          { care: def.id, level: 0 },
          { money: "cost", incomeShare: share },
        ],
      });
      return;
    }
    asked = true;
    events.push({
      id: CARE_DECISION,
      textKey: "event.health.seek_care",
      cause: "circumstance",
      effects: [],
      ask: { eventId: CARE_DECISION, payload: { condition: def.id } },
    });
  };
  for (const def of catalog.all) {
    const roll = rollFor(def.id).next();
    const current = person.conditions.find((c) => c.id === def.id);
    if (!current) {
      if (roll >= onsetProbability(def, person, country)) continue;
      const add: Effect = { condition: "add", id: def.id, severity: 1, ...(def.raises ? { raises: def.raises } : {}) };
      event(def, "begins", `event.condition.${def.id}.begins`, [
        add,
        { stat: "health", add: -3 },
        { stat: "happiness", add: -2 },
      ]);
      conditions = [
        ...conditions,
        { id: def.id, severity: 1, since: person.age, ...(def.raises ? { raises: def.raises } : {}) },
      ];
      seeToIt(def, false);
      continue;
    }
    const odds = conditionOdds(def, current.severity, careLevel(person, def.id));
    if (roll < odds.worsen) {
      const severity = asSeverity(current.severity + 1);
      event(def, "worsens", `event.condition.${def.id}.worsens`, [
        { condition: "add", id: def.id, severity },
        { stat: "health", add: -3 },
        { stat: "happiness", add: -1 },
      ]);
      conditions = conditions.map((c) => (c.id === def.id ? { ...c, severity } : c));
      // It is serious now: another look at what can be done.
      seeToIt(def, severity >= 2);
    } else if (roll > 1 - odds.recover) {
      if (current.severity === 1) {
        event(def, "ends", `event.condition.${def.id}.ends`, [
          { condition: "remove", id: def.id },
          { care: def.id, level: 0 },
          { stat: "happiness", add: 1 },
        ]);
        conditions = conditions.filter((c) => c.id !== def.id);
      } else {
        const severity = asSeverity(current.severity - 1);
        event(def, "eases", `event.condition.${def.id}.eases`, [
          { condition: "add", id: def.id, severity },
          { stat: "happiness", add: 1 },
        ]);
        conditions = conditions.map((c) => (c.id === def.id ? { ...c, severity } : c));
      }
    }
  }
  return { person: { ...person, conditions }, events };
}
