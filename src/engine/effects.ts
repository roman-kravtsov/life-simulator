import { INDEPENDENCE_AGE, yearlyIncome } from "./money";
import type {
  Cause,
  EducationLevel,
  CauseId,
  HealthCondition,
  LifeState,
  Location,
  Person,
  Relationship,
  RelationshipKind,
  Sector,
  StatId,
} from "./types";
import type { Country } from "./world/types";

// Effects change a life (design 2.3). Each applied effect keeps its cause tag.
export type Effect =
  | { stat: StatId; add: number }
  | { set: string; value: number | boolean }
  | { relationship: "add"; relative: Relationship }
  | { relationship: "remove"; id: string }
  /** Moves closeness for one relative (`id`), or every living relative of a `kind`, or all of them. */
  | { relationship: "closeness"; amount: number; id?: string; kind?: RelationshipKind }
  /** A condition begins, or gets the new severity if the person has it already. */
  | { condition: "add"; id: string; severity: HealthCondition["severity"]; raises?: CauseId }
  | { condition: "remove"; id: string }
  /** A one-off cost or windfall as a share of a year's income. Only people on their own money feel it. */
  | { money: "cost" | "windfall"; incomeShare: number }
  /** Leaves school (the year counts), or finishes studying (no more years), or enrols in tertiary school. */
  | { school: "leave" | "finish" | "enrol-tertiary" }
  /** Stays another year at a level; `completes` when it is the level's last year. */
  | { school: "stay"; level: Exclude<EducationLevel, "none">; completes: boolean }
  /** A follow-up event, set for a number of years from now (EVENT-004). */
  | { schedule: string; inYears: number }
  | { work: "lose-job" | "find-job" }
  | { sector: Sector; formal: boolean }
  | { move: Location }
  /** A partner becomes a spouse. */
  | { become: "spouse"; id: string }
  /** How well a condition is looked after: -1 left alone, 0 the usual care, 1 the best (HEALTH-005). */
  | { care: string; level: -1 | 0 | 1 };

export interface AppliedEffect {
  effect: Effect;
  cause: Cause;
  /** The change actually applied, after clamping. Only for stat effects. */
  delta?: number;
}

export const clampStat = (value: number) => Math.min(100, Math.max(0, value));

function addCondition(person: Person, effect: Extract<Effect, { condition: "add" }>): HealthCondition[] {
  const existing = person.conditions.find((c) => c.id === effect.id);
  if (existing) return person.conditions.map((c) => (c === existing ? { ...c, severity: effect.severity } : c));
  const added: HealthCondition = { id: effect.id, severity: effect.severity, since: person.age };
  if (effect.raises) added.raises = effect.raises;
  return [...person.conditions, added];
}

/** Money a person has of their own: independent and out of school. */
const ownsMoney = (person: Person) => person.age >= INDEPENDENCE_AGE && !person.education.inSchool;

const isWorking = (person: Person) => person.work.status === "employed" || person.work.status === "informal";

/** Takes `amount` from savings first, then borrows. */
function spend(money: Person["money"], amount: number): Person["money"] {
  const drawn = Math.min(money.savings, amount);
  return { ...money, savings: money.savings - drawn, debt: money.debt + amount - drawn };
}

/** One effect on a person; `delta` is the change a stat effect actually made, after clamping. */
function applyOne(person: Person, effect: Effect, country?: Country): { person: Person; delta?: number } {
  if ("stat" in effect) {
    const before = person.stats[effect.stat];
    const after = clampStat(before + effect.add);
    return { person: { ...person, stats: { ...person.stats, [effect.stat]: after } }, delta: after - before };
  }
  if ("set" in effect) return { person: { ...person, flags: { ...person.flags, [effect.set]: effect.value } } };
  if ("relationship" in effect) {
    let { relationships } = person;
    if (effect.relationship === "add") {
      if (!relationships.some((r) => r.id === effect.relative.id)) relationships = [...relationships, effect.relative];
    } else if (effect.relationship === "remove") {
      relationships = relationships.filter((r) => r.id !== effect.id);
    } else {
      relationships = relationships.map((r) =>
        r.alive &&
        (effect.id === undefined || r.id === effect.id) &&
        (effect.kind === undefined || r.kind === effect.kind)
          ? { ...r, closeness: clampStat(r.closeness + effect.amount) }
          : r,
      );
    }
    return { person: { ...person, relationships } };
  }
  if ("condition" in effect) {
    const conditions =
      effect.condition === "add" ? addCondition(person, effect) : person.conditions.filter((c) => c.id !== effect.id);
    return { person: { ...person, conditions } };
  }
  if ("money" in effect) {
    if (!country || !ownsMoney(person)) return { person };
    const amount = effect.incomeShare * yearlyIncome(person, country);
    const money =
      effect.money === "cost"
        ? spend(person.money, amount)
        : { ...person.money, savings: person.money.savings + amount };
    return { person: { ...person, money } };
  }
  if ("school" in effect) {
    const { education } = person;
    if (effect.school === "stay") {
      const years = education.years + 1;
      const next = effect.completes
        ? { ...education, years, level: effect.level, inSchool: effect.level !== "tertiary" }
        : { ...education, years, inSchool: true };
      return { person: { ...person, education: next } };
    }
    const next =
      effect.school === "leave"
        ? { ...education, inSchool: false, years: education.years + 1 }
        : { ...education, inSchool: effect.school === "enrol-tertiary" };
    return { person: { ...person, education: next } };
  }
  if ("schedule" in effect) {
    return {
      person: {
        ...person,
        scheduled: [...person.scheduled, { id: effect.schedule, age: person.age + effect.inYears }],
      },
    };
  }
  if ("work" in effect) {
    const { work } = person;
    if (effect.work === "lose-job") {
      return { person: isWorking(person) ? { ...person, work: { ...work, status: "unemployed" } } : person };
    }
    if (work.status !== "unemployed") return { person };
    return { person: { ...person, work: { ...work, status: work.formal === false ? "informal" : "employed" } } };
  }
  if ("sector" in effect) {
    const work = { ...person.work, sector: effect.sector, formal: effect.formal };
    return {
      person: {
        ...person,
        work: isWorking(person) ? { ...work, status: effect.formal ? "employed" : "informal" } : work,
      },
    };
  }
  if ("move" in effect) return { person: { ...person, location: effect.move } };
  if ("become" in effect) {
    const relationships = person.relationships.map((r) => (r.id === effect.id ? { ...r, kind: "spouse" as const } : r));
    return { person: { ...person, relationships } };
  }
  return { person: { ...person, flags: { ...person.flags, [`care.${effect.care}`]: effect.level } } };
}

export function applyEffectsToPerson(
  person: Person,
  effects: readonly Effect[],
  cause: Cause,
  country?: Country,
): { person: Person; applied: AppliedEffect[] } {
  let current = person;
  const applied: AppliedEffect[] = [];
  for (const effect of effects) {
    const result = applyOne(current, effect, country);
    current = result.person;
    applied.push({ effect, cause, ...(result.delta === undefined ? {} : { delta: result.delta }) });
  }
  return { person: current, applied };
}

export function applyEffects(
  state: LifeState,
  effects: readonly Effect[],
  cause: Cause,
  country?: Country,
): { state: LifeState; applied: AppliedEffect[] } {
  const { person, applied } = applyEffectsToPerson(state.person, effects, cause, country);
  return { state: { ...state, person }, applied };
}
