// The yearly focus plan (DEC-003, DEC-004, FAM-005, CAREER-004, CAREER-006). From six, each year the
// player spends three focus points across Learn, Earn, Health, Belonging and Rest. Circumstances take some
// points before the player chooses: a child who must work has a point on Earn, an ill person has one
// on Health, and someone looking after a sick relative or a baby has one on Belonging. Points in one area
// have diminishing returns. The effect of a plan is measured against the default plan for the
// person's situation (units above or below it), so the default is neutral and the calibration of the
// models behind it holds; moving points trades one area for another.
import { conditionCatalog } from "../content/healthConditions";
import { focusPointsLost, type ConditionCatalog } from "./health";
import type { FocusArea, Person, Plan, StoredPlan } from "./types";

export const FOCUS_AREAS: readonly FocusArea[] = ["learn", "earn", "health", "belonging", "rest"];

/** Points to spend each year. */
export const FOCUS_BUDGET = 3;

/** The plan starts at this age; before it nobody chooses. */
export const PLAN_START_AGE = 6;

/** Circumstance never takes more than this many points, so the player always has at least one to place. */
export const MAX_FORCED = FOCUS_BUDGET - 1;

/** Each extra point in an area is worth this much of the one before it. */
const RETURN_RATIO = 0.6;

/** The value of `points` in one area: 1, 1.6, 1.96 ... for one, two, three points. */
export const focusValue = (points: number): number => (1 - RETURN_RATIO ** points) / (1 - RETURN_RATIO);

/**
 * What a unit above the default plan does. Authored: nudges in the direction design 3.3 describes,
 * small enough that circumstances still decide most of a life.
 */
export const FOCUS_EFFECT = {
  /** Learn: share added to the yearly skill gain, and share taken off the odds of leaving school, per unit. */
  learn: { skills: 0.3, leaving: 0.12 },
  /** Earn: share of income saved, share added to the odds of finding work, share taken off those of losing it. */
  earn: { saving: 0.03, finding: 0.35, losing: 0.15 },
  /** Health: points on the health the person drifts toward, log hazard of death and share off the onset of conditions. */
  health: { norm: 3, hazard: 0.1, onset: 0.12 },
  /** Belonging: points on the belonging norm, on closeness, and share added to the odds of making friends and meeting a partner. */
  belonging: { norm: 4, closeness: 3, meeting: 0.3 },
  /** Rest: points on the happiness norm and share taken off the sting of bad news. */
  rest: { norm: 3, buffer: 0.1 },
} as const;

export type LockReason = "tooYoung" | "retired";

export type ForcedReason = "illness" | "childLabour" | "caregiving";

export interface ForcedPoint {
  area: FocusArea;
  points: number;
  reason: ForcedReason;
}

export interface PlanView {
  /** What the person actually lives by: forced points plus the player's own, unspent ones resting. */
  points: Plan;
  /** The player's own part of it. */
  chosen: Plan;
  forced: ForcedPoint[];
  /** Areas the player cannot put points in, with the reason. */
  locked: Partial<Record<FocusArea, LockReason>>;
  /** Points the player places themselves. */
  free: number;
  /** The plan that follows the person's situation until the player changes it. */
  default: Plan;
}

export const emptyPlan = (): Plan => ({ learn: 0, earn: 0, health: 0, belonging: 0, rest: 0 });

const planOf = (areas: readonly FocusArea[]): Plan => {
  const plan = emptyPlan();
  for (const area of areas) plan[area]++;
  return plan;
};

export const planTotal = (plan: Plan): number => FOCUS_AREAS.reduce((sum, area) => sum + plan[area], 0);

/** Areas this person cannot choose: a child cannot take up work (unless made to), a retired person has stopped. */
export function lockedAreas(person: Person): Partial<Record<FocusArea, LockReason>> {
  if (person.work.status === "retired") return { earn: "retired" };
  if (person.age < 15 && person.flags.childLabour !== true) return { earn: "tooYoung" };
  return {};
}

/** True when a living relative needs looking after, or a baby does (FAM-005). */
export function caregivingDuty(person: Person): boolean {
  const alive = person.relationships.filter((r) => r.alive);
  if (
    alive.some(
      (r) => (r.kind === "mother" || r.kind === "father" || r.kind === "partner" || r.kind === "spouse") && r.ill,
    )
  )
    return true;
  if (person.age >= 10 && person.age < 18 && alive.some((r) => r.kind === "sibling" && r.age < 5)) return true;
  return alive.some((r) => r.kind === "child" && r.age < 3);
}

/** The points circumstance takes before the player chooses, at most MAX_FORCED in all. */
export function forcedPoints(person: Person, catalog: ConditionCatalog = conditionCatalog): ForcedPoint[] {
  const wanted: ForcedPoint[] = [];
  const ill = focusPointsLost(person.conditions, catalog);
  if (ill > 0) wanted.push({ area: "health", points: ill, reason: "illness" });
  if (person.flags.childLabour === true) wanted.push({ area: "earn", points: 1, reason: "childLabour" });
  if (caregivingDuty(person)) wanted.push({ area: "belonging", points: 1, reason: "caregiving" });
  const out: ForcedPoint[] = [];
  let room = MAX_FORCED;
  for (const f of wanted) {
    const points = Math.min(f.points, room);
    if (points > 0) out.push({ ...f, points });
    room -= points;
  }
  return out;
}

/** Where a person with nothing set aside would put their points, most wanted first. */
function wantedOrder(person: Person): FocusArea[] {
  if (person.work.status === "retired") return ["health", "belonging", "rest"];
  if (person.age >= 18 && !person.education.inSchool) return ["earn", "health", "belonging"];
  return ["learn", "health", "belonging"];
}

/** The default plan for the person's situation, before circumstance takes any points. */
export const defaultPlan = (person: Person): Plan => planOf(wantedOrder(person).slice(0, FOCUS_BUDGET));

/**
 * The plan this person lives by this year: circumstance takes its points first (DEC-004), the player's
 * carried-over choices fill the rest, with points in locked areas and any left over resting. A person
 * who has never changed the plan follows the default for their situation.
 */
export function resolvePlan(
  person: Person,
  stored?: StoredPlan,
  catalog: ConditionCatalog = conditionCatalog,
): PlanView {
  const forced = forcedPoints(person, catalog);
  const forcedTotal = forced.reduce((sum, f) => sum + f.points, 0);
  const free = FOCUS_BUDGET - forcedTotal;
  const locked = lockedAreas(person);
  const reference = defaultPlan(person);

  const chosen = emptyPlan();
  let room = free;
  if (stored?.custom) {
    for (const area of FOCUS_AREAS) {
      if (locked[area]) continue;
      const take = Math.min(room, Math.max(0, Math.floor(stored.points[area])));
      chosen[area] = take;
      room -= take;
    }
  } else {
    // A point circumstance has already put on an area the default plan wanted is not wanted twice: an
    // illness takes a point of Health from a plan that had one for Health anyway, and gives no bonus.
    const covered = new Set(forced.filter((f) => reference[f.area] > 0).map((f) => f.area));
    for (const area of wantedOrder(person)) {
      if (room <= 0) break;
      if (locked[area] || covered.has(area)) continue;
      chosen[area]++;
      room--;
    }
  }
  chosen.rest += room;

  const points = { ...chosen };
  for (const f of forced) points[f.area] += f.points;
  return { points, chosen, forced, locked, free, default: reference };
}

/** How far above or below the default plan each area is, with diminishing returns. */
export function focusUnits(view: PlanView): Record<FocusArea, number> {
  const units = emptyPlan();
  for (const area of FOCUS_AREAS) units[area] = focusValue(view.points[area]) - focusValue(view.default[area]);
  return units;
}

/** True for a plan that spends exactly the budget the player has, nothing in a locked area. */
export function isValidChoice(person: Person, plan: Plan, catalog: ConditionCatalog = conditionCatalog): boolean {
  const view = resolvePlan(person, undefined, catalog);
  if (FOCUS_AREAS.some((a) => !Number.isInteger(plan[a]) || plan[a] < 0)) return false;
  if (FOCUS_AREAS.some((a) => plan[a] > 0 && view.locked[a])) return false;
  return planTotal(plan) === view.free;
}
