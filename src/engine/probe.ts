// The agency probe (ADMIN-005): plays batches of lives with different plans and different answers to the
// decisions, and measures what each one changed. It is the instrument the balance pass is judged by, so
// it plays the real engine (`advance`) and reads the real summary shares, never a model of them.
//
// Every comparison is paired: the same seed gives the same birth and, until the first difference, the
// same life (each subsystem has its own random stream), so the gap between a plan and the default course
// is the plan's doing and not the luck of the draw.
import { catalog as contentCatalog } from "../content/events";
import { defaultChoiceId, type DecisionContext } from "./decisions";
import { advance, decisionCard, newLife } from "./life";
import { FOCUS_AREAS, PLAN_START_AGE, emptyPlan, planTotal, resolvePlan, wantedOrder } from "./focus";
import { yearlyIncome } from "./money";
import { shaping } from "./summary";
import { systemDecision } from "./systemDecisions";
import type { EventCatalog } from "./events";
import { STAT_IDS, type FocusArea, type LifeState, type Person, type Plan } from "./types";
import type { Country } from "./world/types";

/** How the player fills in the plan each year. `default` never touches it: the course the models assume. */
export type PlanRule =
  | { kind: "default" }
  /** Every free point on one area (the default plan where that area is locked). */
  | { kind: "all-in"; area: FocusArea }
  /** The default plan with its last point (the one it wants least) moved to one area: the value of a single point. */
  | { kind: "shift"; area: FocusArea }
  /** A plan made for the stage of life, which is what a player who thinks about it would do. */
  | { kind: "deliberate" };

export interface Strategy {
  id: string;
  label: string;
  plan: PlanRule;
}

export const STRATEGIES: readonly Strategy[] = [
  { id: "default", label: "Default course", plan: { kind: "default" } },
  ...FOCUS_AREAS.map((area): Strategy => ({
    id: `all-${area}`,
    label: `All points on ${area}`,
    plan: { kind: "all-in", area },
  })),
  ...FOCUS_AREAS.filter((area) => area !== "belonging").map((area): Strategy => ({
    id: `shift-${area}`,
    label: `One point moved to ${area}`,
    plan: { kind: "shift", area },
  })),
  { id: "deliberate", label: "Deliberate plan for each stage", plan: { kind: "deliberate" } },
];

/** One life to play: the seed and the country it is born in. */
export interface LifeSpec {
  seed: string;
  country: Country;
}

const OUTCOME_AGES = { rank: 35, wealth: 45, health: 45 } as const;

/** Adult years that the averages over time are taken across: from 20 up to and including 59. */
const ADULT_YEARS = { from: 20, to: 59 } as const;

/** What one life came to. A field is `undefined` when the person died before it could be read. */
export interface Outcomes {
  /** Completed years at death. */
  lifespan: number;
  /** Skill points at 35. */
  skills35?: number;
  /** Income percentile (1 to 100) at 35: the rank. */
  rank35?: number;
  /** Savings minus debt at 45, in years of that person's own income. */
  wealth45?: number;
  health45?: number;
  /** Mean happiness and belonging across the adult years lived from 20 to 59. */
  happiness?: number;
  belonging?: number;
  /** Share of the adult years from 20 to 59 spent out of work, among those in the labour force. */
  outOfWork?: number;
  /** The summary's shares of what shaped the life, over the four stats (SUM-004). */
  choiceShare: number;
  circumstanceShare: number;
  chanceShare: number;
  /** How many of the four stats the summary's sentence names choice for, as the main cause or as a real part (0 to 4). */
  choiceNamed: number;
}

export type Metric = keyof Outcomes;

/** The measures the report compares, with the unit it states them in. */
export const METRICS: readonly { id: Exclude<Metric, "lifespan"> | "lifespan"; label: string; unit: string }[] = [
  { id: "lifespan", label: "Years lived", unit: "years" },
  { id: "skills35", label: "Skills at 35", unit: "points" },
  { id: "rank35", label: "Income rank at 35", unit: "percentile points" },
  { id: "wealth45", label: "Net savings at 45", unit: "years of income" },
  { id: "health45", label: "Health at 45", unit: "points" },
  { id: "happiness", label: "Happiness, 20 to 59", unit: "points" },
  { id: "belonging", label: "Belonging, 20 to 59", unit: "points" },
  { id: "outOfWork", label: "Out of work, 20 to 59", unit: "share of labour-force years" },
  { id: "choiceShare", label: "Share credited to choice", unit: "share" },
  { id: "choiceNamed", label: "Stats where the summary names choice", unit: "of 4" },
];

/** The plan this rule sets for the person this year, or `undefined` to leave it to the default course. */
export function planFor(rule: PlanRule, person: Person): Plan | undefined {
  if (rule.kind === "default" || person.age < PLAN_START_AGE) return undefined;
  const view = resolvePlan(person);
  if (view.free === 0) return emptyPlan();
  if (rule.kind === "shift") {
    // The point the default plan wants least goes to the area instead; where that is impossible, the default stands.
    const plan = { ...view.chosen };
    const last = wantedOrder(person)
      .reverse()
      .find((area) => plan[area] > 0);
    if (view.locked[rule.area] || !last || last === rule.area) return plan;
    plan[last]--;
    plan[rule.area]++;
    return plan;
  }
  const plan = emptyPlan();
  if (rule.kind === "all-in") {
    // Where the area is locked the person lives by the default plan (the same points as before).
    if (view.locked[rule.area]) return { ...view.chosen };
    plan[rule.area] = view.free;
    return plan;
  }
  for (const area of deliberateOrder(person)) {
    if (view.locked[area]) continue;
    if (planTotal(plan) >= view.free) break;
    plan[area]++;
  }
  // Whatever is left rests, which is where the engine puts it too.
  plan.rest += view.free - planTotal(plan);
  return plan;
}

/**
 * What a player who thinks about the plan would do at each age: study while young, build a livelihood
 * and a family in the middle years, and keep health and company at the end. It differs from the default
 * (Learn, Health, Belonging; then Earn, Health, Belonging) by putting a second point where a stage needs it.
 */
function deliberateOrder(person: Person): FocusArea[] {
  if (person.work.status === "retired") return ["health", "belonging", "rest"];
  if (person.education.inSchool) return ["learn", "learn", "health"];
  if (person.age < 30) return ["earn", "learn", "belonging"];
  if (person.age < 55) return ["earn", "earn", "health"];
  return ["health", "earn", "belonging"];
}

/** Reads what the outcomes need from the person at the end of a year; one `Reader` for one life. */
class Reader {
  private readonly values: Partial<Outcomes> = {};
  private happiness: number[] = [];
  private belonging: number[] = [];
  private forceYears = 0;
  private unemployedYears = 0;

  constructor(private readonly country: Country) {}

  /** A copy that carries on from where this one stands, for a fork of the life. */
  clone(): Reader {
    const copy = new Reader(this.country);
    Object.assign(copy.values, this.values);
    copy.happiness = [...this.happiness];
    copy.belonging = [...this.belonging];
    copy.forceYears = this.forceYears;
    copy.unemployedYears = this.unemployedYears;
    return copy;
  }

  /** Called with the state after each year, so `person.age` is the age just reached. */
  see(person: Person): void {
    const { age } = person;
    if (age === OUTCOME_AGES.rank) {
      this.values.skills35 = person.stats.skills;
      this.values.rank35 = person.money.percentile;
    }
    if (age === OUTCOME_AGES.wealth) {
      const income = yearlyIncome(person, this.country);
      this.values.wealth45 = income > 0 ? (person.money.savings - person.money.debt) / income : 0;
    }
    if (age === OUTCOME_AGES.health) this.values.health45 = person.stats.health;
    const lived = age - 1;
    if (lived >= ADULT_YEARS.from && lived <= ADULT_YEARS.to) {
      this.happiness.push(person.stats.happiness);
      this.belonging.push(person.stats.belonging);
      const { status } = person.work;
      if (status === "unemployed") {
        this.forceYears++;
        this.unemployedYears++;
      } else if (status === "employed" || status === "informal") this.forceYears++;
    }
  }

  outcomes(life: LifeState): Outcomes {
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
    const { overall, stats } = shaping(life.history);
    const happiness = mean(this.happiness);
    const belonging = mean(this.belonging);
    return {
      lifespan: life.death!.age,
      ...this.values,
      ...(happiness === undefined ? {} : { happiness }),
      ...(belonging === undefined ? {} : { belonging }),
      ...(this.forceYears > 0 ? { outOfWork: this.unemployedYears / this.forceYears } : {}),
      choiceShare: overall.choice,
      circumstanceShare: overall.circumstance,
      chanceShare: overall.chance,
      choiceNamed: STAT_IDS.filter((id) => stats[id].dominant === "choice" || stats[id].dominant === "mixedChoice")
        .length,
    };
  }
}

/** The choice the default course takes at the waiting decision. */
function defaultAnswer(life: LifeState, country: Country, catalog: EventCatalog): string {
  const { turn } = life;
  const eventId = turn!.decision.eventId;
  const def = systemDecision(eventId) ?? catalog.get(eventId);
  if (!def) throw new Error(`Unknown decision: ${eventId}`);
  const ctx: DecisionContext = { person: turn!.person, country, payload: turn!.decision.payload ?? {} };
  return defaultChoiceId(def, ctx);
}

interface Played {
  life: LifeState;
  reader: Reader;
}

/** Lives the rest of a life from `state`, the plan by `rule` and every decision by the default course, except the `first` answer. */
function finish(
  from: LifeState,
  country: Country,
  rule: PlanRule,
  reader: Reader,
  catalog: EventCatalog,
  first?: string,
): Played {
  let state = from;
  let answer = first;
  while (state.person.alive) {
    if (!state.turn) {
      const plan = planFor(rule, state.person);
      state = advance(state, { kind: "continue", ...(plan ? { plan } : {}) }, country, catalog).state;
    }
    if (state.turn) {
      state = advance(
        state,
        { kind: "choose", choiceId: answer ?? defaultAnswer(state, country, catalog) },
        country,
        catalog,
      ).state;
      answer = undefined;
    }
    if (state.person.alive) reader.see(state.person);
  }
  return { life: state, reader };
}

/** One whole life under a strategy: a plan rule and the default answer at every decision. */
export function playStrategy(spec: LifeSpec, strategy: Strategy, catalog: EventCatalog = contentCatalog): Outcomes {
  const start = newLife({ seed: spec.seed, country: spec.country, settings: { pace: "every-year" } });
  const { life, reader } = finish(start, spec.country, strategy.plan, new Reader(spec.country), catalog);
  return reader.outcomes(life);
}

/** The outcomes of one answer to one decision, in one life. */
export interface ChoiceOutcome {
  eventId: string;
  choiceId: string;
  /** True for the answer the default course gives. */
  isDefault: boolean;
  outcomes: Outcomes;
}

/**
 * Plays the default course and, at the first time each decision comes up, forks the life: every open
 * choice is answered in turn and the rest of the life played by the default course. The default
 * choice's own continuation is the baseline, so the comparison is the answer and nothing else.
 */
export function playDecisions(spec: LifeSpec, catalog: EventCatalog = contentCatalog): ChoiceOutcome[] {
  const { country } = spec;
  const reader = new Reader(country);
  let state = newLife({ seed: spec.seed, country, settings: { pace: "every-year" } });
  const forked = new Set<string>();
  const rows: ChoiceOutcome[] = [];
  while (state.person.alive) {
    state = advance(state, { kind: "continue" }, country, catalog).state;
    if (state.turn) {
      const { eventId } = state.turn.decision;
      const chosen = defaultAnswer(state, country, catalog);
      const open = decisionCard(state, country, catalog)!
        .choices.filter((c) => !c.lockedReason)
        .map((c) => c.id);
      if (!forked.has(eventId) && open.length > 1) {
        forked.add(eventId);
        for (const choiceId of open) {
          const { life, reader: after } = finish(
            state,
            country,
            { kind: "default" },
            reader.clone(),
            catalog,
            choiceId,
          );
          rows.push({ eventId, choiceId, isDefault: choiceId === chosen, outcomes: after.outcomes(life) });
        }
      }
      state = advance(state, { kind: "choose", choiceId: chosen }, country, catalog).state;
    }
    if (state.person.alive) reader.see(state.person);
  }
  return rows;
}

export interface Estimate {
  /** Mean of the paired differences. */
  mean: number;
  /** Standard error of that mean. */
  se: number;
  /** How many pairs. */
  n: number;
}

/** True when the difference is more than two standard errors from zero. */
export const isClear = (e: Estimate): boolean => e.n > 1 && Math.abs(e.mean) > 2 * e.se;

/** The mean and standard error of the differences `a[i] - b[i]` over the pairs where both are known. */
export function paired(a: readonly (number | undefined)[], b: readonly (number | undefined)[]): Estimate {
  const diffs: number[] = [];
  a.forEach((x, i) => {
    const y = b[i];
    if (x !== undefined && y !== undefined) diffs.push(x - y);
  });
  const n = diffs.length;
  if (n === 0) return { mean: 0, se: 0, n: 0 };
  const mean = diffs.reduce((s, d) => s + d, 0) / n;
  const variance = n > 1 ? diffs.reduce((s, d) => s + (d - mean) ** 2, 0) / (n - 1) : 0;
  return { mean, se: Math.sqrt(variance / n), n };
}

/** The mean of a measure over the lives where it is known. */
export function average(values: readonly (number | undefined)[]): { mean: number; n: number } {
  const known = values.filter((v): v is number => v !== undefined);
  return { mean: known.length ? known.reduce((s, v) => s + v, 0) / known.length : 0, n: known.length };
}

export interface StrategyReport {
  strategy: Strategy;
  /** Mean outcomes of the strategy's lives. */
  means: Record<Metric, number>;
  /** The difference from the default course, paired by life. */
  versusDefault: Record<Metric, Estimate>;
}

export interface AreaReport {
  lives: number;
  strategies: StrategyReport[];
}

const METRIC_IDS: readonly Metric[] = [...METRICS.map((m) => m.id), "circumstanceShare", "chanceShare"];

/** Plays each strategy over the same lives and compares each with the default course. */
export function probeStrategies(
  specs: readonly LifeSpec[],
  strategies: readonly Strategy[] = STRATEGIES,
  catalog: EventCatalog = contentCatalog,
): AreaReport {
  const played = strategies.map((strategy) => ({
    strategy,
    outcomes: specs.map((spec) => playStrategy(spec, strategy, catalog)),
  }));
  const base = played.find((p) => p.strategy.plan.kind === "default")?.outcomes;
  if (!base) throw new Error("The probe needs the default course to compare with");
  const column = (outcomes: Outcomes[], id: Metric) => outcomes.map((o) => o[id]);
  return {
    lives: specs.length,
    strategies: played.map(({ strategy, outcomes }) => ({
      strategy,
      means: Object.fromEntries(METRIC_IDS.map((id) => [id, average(column(outcomes, id)).mean])) as Record<
        Metric,
        number
      >,
      versusDefault: Object.fromEntries(
        METRIC_IDS.map((id) => [id, paired(column(outcomes, id), column(base, id))]),
      ) as Record<Metric, Estimate>,
    })),
  };
}

export interface DecisionReportRow {
  eventId: string;
  choiceId: string;
  isDefault: boolean;
  /** Lives in which the decision came up and the choice could be taken. */
  lives: number;
  /** The difference from the default choice, paired by life. */
  versusDefault: Record<Metric, Estimate>;
}

/** Plays the decisions over the lives and compares each choice with the default choice of the same decision. */
export function probeDecisions(
  specs: readonly LifeSpec[],
  catalog: EventCatalog = contentCatalog,
): DecisionReportRow[] {
  const byKey = new Map<
    string,
    { eventId: string; choiceId: string; isDefault: boolean; rows: Outcomes[]; base: Outcomes[] }
  >();
  for (const spec of specs) {
    const rows = playDecisions(spec, catalog);
    for (const row of rows) {
      const base = rows.find((r) => r.eventId === row.eventId && r.isDefault);
      if (!base) continue;
      // A choice can be the default in some lives and not in others (the marked default may be locked), so the flag is part of the key.
      const key = `${row.eventId}\u0000${row.choiceId}\u0000${row.isDefault}`;
      const entry = byKey.get(key) ?? {
        eventId: row.eventId,
        choiceId: row.choiceId,
        isDefault: row.isDefault,
        rows: [],
        base: [],
      };
      entry.rows.push(row.outcomes);
      entry.base.push(base.outcomes);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .map(({ eventId, choiceId, isDefault, rows, base }) => ({
      eventId,
      choiceId,
      isDefault,
      lives: rows.length,
      versusDefault: Object.fromEntries(
        METRIC_IDS.map((id) => [
          id,
          paired(
            rows.map((o) => o[id]),
            base.map((o) => o[id]),
          ),
        ]),
      ) as Record<Metric, Estimate>,
    }))
    .sort((a, b) => a.eventId.localeCompare(b.eventId) || Number(b.isDefault) - Number(a.isDefault));
}

/** Which way is better for each measure the dominance check reads: more (1) or less (-1). */
const BETTER: Partial<Record<Metric, 1 | -1>> = {
  lifespan: 1,
  skills35: 1,
  rank35: 1,
  wealth45: 1,
  health45: 1,
  happiness: 1,
  belonging: 1,
  outOfWork: -1,
};

/**
 * True when plan `a` is at least as good as `b` on every outcome (within noise) and clearly better on one.
 * The noise treats the two differences from the default as independent though they share its lives, so
 * the margin is a little off in both directions; it is a guard against a gross imbalance, not a test.
 */
export function dominates(a: StrategyReport, b: StrategyReport): boolean {
  let clearlyBetter = false;
  for (const [id, direction] of Object.entries(BETTER) as [Metric, 1 | -1][]) {
    const x = a.versusDefault[id];
    const y = b.versusDefault[id];
    const gap = direction * (x.mean - y.mean);
    const noise = 2 * Math.hypot(x.se, y.se);
    if (gap < -noise) return false;
    if (gap > noise) clearlyBetter = true;
  }
  return clearlyBetter;
}

/** One target of the balance pass and whether the probe's numbers meet it. */
export interface BalanceCheck {
  id: string;
  target: string;
  pass: boolean;
  /** The numbers behind the verdict. */
  detail: string;
}

/**
 * The first balance pass's targets (ROADMAP.md Phase B), read off the probe. The thresholds are authored
 * and sit here so a change of mind is one edit: each area's point should pay in its own domain, Earn must
 * show in the rank and not only in savings, no single point should beat the others everywhere, and what
 * the player does should show in the shares without the default course claiming any.
 */
export function balanceChecks(report: AreaReport): BalanceCheck[] {
  const get = (id: string): StrategyReport => {
    const found = report.strategies.find((s) => s.strategy.id === id);
    if (!found) throw new Error(`The probe has no plan "${id}"`);
    return found;
  };
  const gain = (id: string, metric: Metric, atLeast: number, below = false) => {
    const e = get(id).versusDefault[metric];
    return { pass: isClear(e) && (below ? e.mean <= -atLeast : e.mean >= atLeast), value: e.mean };
  };
  const checks: BalanceCheck[] = [];
  const add = (id: string, target: string, pass: boolean, detail: string) => checks.push({ id, target, pass, detail });

  const base = get("default").means.choiceShare;
  const deliberate = get("deliberate").means.choiceShare;
  const lead = get("deliberate").versusDefault.choiceShare;
  add(
    "default-counts-some",
    "The default course credits 10% to 15% of a life to choice (accepting it is a choice, Roman 2026-10-29)",
    base >= 0.1 && base <= 0.15,
    `${(base * 100).toFixed(1)}%`,
  );
  add(
    "deliberate-shows",
    "A deliberate plan credits clearly more to choice than the default course, at least 3 points more",
    isClear(lead) && lead.mean >= 0.03,
    `${(deliberate * 100).toFixed(1)}% against ${(base * 100).toFixed(1)}%`,
  );
  const named = get("deliberate").means.choiceNamed;
  const namedBase = get("default").means.choiceNamed;
  const namedLead = get("deliberate").versusDefault.choiceNamed;
  add(
    "choice-shows",
    "The summary names choice in clearly more stats for a deliberate life than for the default course, at least 0.25 more of the four",
    isClear(namedLead) && namedLead.mean >= 0.25,
    `${named.toFixed(2)} stats against ${namedBase.toFixed(2)} of 4`,
  );
  const learn = gain("shift-learn", "skills35", 2);
  add(
    "learn-pays",
    "One point on Learn raises skills at 35 by at least 2 points",
    learn.pass,
    `${learn.value.toFixed(1)}`,
  );
  const savings = gain("shift-earn", "wealth45", 0.2);
  const work = gain("shift-earn", "outOfWork", 0.005, true);
  add(
    "earn-pays",
    "One point on Earn raises savings at 45 by at least 0.2 years of income and cuts time out of work by at least 0.5 points",
    savings.pass && work.pass,
    `${savings.value.toFixed(2)} years of income, ${(work.value * 100).toFixed(1)} pp`,
  );
  const earnRank = gain("shift-earn", "rank35", 1.5);
  add(
    "earn-rank",
    "One point on Earn raises the income rank at 35 by at least 1.5",
    earnRank.pass,
    `${earnRank.value.toFixed(1)}`,
  );
  const learnRank = get("shift-learn").versusDefault.rank35.mean;
  add(
    "learn-bounded",
    "Learn's gain in rank is under three times Earn's",
    earnRank.value > 0 && learnRank < 3 * earnRank.value,
    `${learnRank.toFixed(1)} against ${earnRank.value.toFixed(1)}`,
  );
  const years = gain("shift-health", "lifespan", 0.3);
  const health = gain("shift-health", "health45", 1);
  add(
    "health-pays",
    "One point on Health adds at least 0.3 years of life and 1 point of health at 45",
    years.pass && health.pass,
    `${years.value.toFixed(1)} years, ${health.value.toFixed(1)} points`,
  );
  const rest = gain("shift-rest", "happiness", 1);
  add("rest-pays", "One point on Rest raises happiness by at least 1 point", rest.pass, `${rest.value.toFixed(1)}`);
  const belonging = gain("all-belonging", "belonging", 3);
  add(
    "belonging-pays",
    "All points on Belonging raise belonging by at least 3 points",
    belonging.pass,
    `${belonging.value.toFixed(1)}`,
  );
  const singles = ["shift-learn", "shift-earn", "shift-health", "shift-rest"].map(get);
  const beaten = singles.flatMap((a) =>
    singles.filter((b) => a !== b && dominates(a, b)).map((b) => `${a.strategy.id} over ${b.strategy.id}`),
  );
  add(
    "no-single-point-dominates",
    "No single point is at least as good as another on every outcome",
    beaten.length === 0,
    beaten.length ? beaten.join(", ") : "none",
  );
  return checks;
}
