// Decisions (DEC-001, DEC-002, DEC-005). An event can offer choices; each choice has outcomes with
// probabilities and effects. Choices can be hidden or locked, with the reason shown. The odds lens
// reads the same probabilities the engine rolls, so what the card says cannot drift from what happens.
import { allHold, holds, type Condition, type ConditionContext } from "./conditions";
import type { Effect } from "./effects";
import type { PendingEvent } from "./events";
import { ownsMoney } from "./money";
import type { Rng } from "./rng";
import type {
  Cause,
  DecisionRecord,
  DriftRecord,
  EventRecord,
  HelpTopic,
  Person,
  Plan,
  Relationship,
  Sensitivity,
} from "./types";

/** What a system that raised a decision knows, kept with the turn so the choice can be resolved later. */
export interface Payload {
  relative?: Relationship;
  condition?: string;
  /** What the decision costs, in PPP dollars. */
  cost?: number;
  level?: string;
  /** The relatives playing the event's roles, by role. */
  roleIds?: Record<string, string>;
}

export interface DecisionContext extends ConditionContext {
  payload: Payload;
}

export type Effects = readonly Effect[] | ((ctx: DecisionContext) => Effect[]);

/** A relative weight, for outcomes whose chances shift with the person. */
export interface Weight {
  weight: number;
  modifiers?: { when: Condition[]; multiply: number }[];
}

/** Where an outcome's chance comes from: a probability, a weight, or a function of the person (system decisions). */
export type OutcomeOdds = number | Weight | ((ctx: DecisionContext) => number);

export interface OutcomeDef {
  p: OutcomeOdds;
  effects: Effects;
  /** What happens, as a string key. */
  text: string;
  /** A short phrase for the odds lens, such as "steady work". Required when the choice has more than one outcome. */
  lens?: string;
}

/** A reason a choice cannot be taken. Shown to the player. */
export type Lock =
  { unless: Condition[]; reason: string } | { when: (ctx: DecisionContext) => boolean; reason: string };

export interface ChoiceDef {
  id: string;
  /** String key of the choice's label. */
  text: string;
  /** The course the calibrated models assume, taken when nobody is choosing (auto play, calibration). */
  default?: boolean;
  /** Hidden when these do not hold. */
  requires?: Condition[];
  /** Shown but locked, with the reason, when a lock applies. */
  locks?: Lock[];
  outcomes: OutcomeDef[];
  /** Odds lines beyond the choice's own outcomes, for a chance the engine works out (for example finishing a degree). */
  lens?: (ctx: DecisionContext) => LensLine[];
  /** What taking the choice costs, in PPP dollars, once or each year. Shown on the card. */
  cost?: (ctx: DecisionContext) => Cost | undefined;
}

export interface Cost {
  amount: number;
  perYear?: boolean;
  /** Charged to a student's own account too (tuition); other costs fall on the household of a child or student and are not shown. */
  borneInSchool?: boolean;
}

export interface LensLine {
  /** String key of what the odds are about. */
  key: string;
  p: number;
  /** The same chance if the other course is taken, to show how the choice shifts it. */
  vs?: number;
}

/** Odds in words (DEC-005): never decimals. */
export type OddsBand =
  { kind: "almostNever" } | { kind: "fraction"; num: number; den: number } | { kind: "almostSure" };

/** The fractions the lens speaks in, each with the range of probabilities it stands for. */
const BANDS: readonly { upTo: number; num: number; den: number }[] = [
  { upTo: 0.07, num: 1, den: 20 },
  { upTo: 0.15, num: 1, den: 10 },
  { upTo: 0.225, num: 1, den: 5 },
  { upTo: 0.29, num: 1, den: 4 },
  { upTo: 0.42, num: 1, den: 3 },
  { upTo: 0.58, num: 1, den: 2 },
  { upTo: 0.71, num: 2, den: 3 },
  { upTo: 0.775, num: 3, den: 4 },
  { upTo: 0.85, num: 4, den: 5 },
  { upTo: 0.95, num: 9, den: 10 },
];

export function oddsBand(p: number): OddsBand {
  if (p < 0.02) return { kind: "almostNever" };
  if (p >= 0.95) return { kind: "almostSure" };
  const band = BANDS.find((b) => p < b.upTo)!;
  return { kind: "fraction", num: band.num, den: band.den };
}

/** A choice as the player sees it. */
export interface ChoiceView {
  id: string;
  textKey: string;
  /** Set when the choice is locked: why. */
  lockedReason?: string;
  cost?: Cost;
  lens: (LensLine & { band: OddsBand; vsBand?: OddsBand })[];
}

export interface DecisionCard {
  eventId: string;
  textKey: string;
  vars: Record<string, string | number>;
  sensitivity?: Sensitivity;
  helpTopic?: HelpTopic;
  dataNote?: EventRecord["dataNote"];
  choices: ChoiceView[];
}

/** The year in progress while it waits for the player (DEC-001). Plain data, so it can be saved. */
export interface Turn {
  /** The age being lived. */
  year: number;
  /** The person after the year's checks, before any event's effects. */
  person: Person;
  /** What has happened this year, with its effects still to apply. */
  pending: PendingEvent[];
  decision: {
    eventId: string;
    textKey: string;
    vars?: Record<string, string | number>;
    payload?: Payload;
    sensitivity?: Sensitivity;
    helpTopic?: HelpTopic;
    dataNote?: EventRecord["dataNote"];
  };
  /** The focus the year is lived with, for the record. */
  plan?: Plan;
  /** What moved the stats this year besides events, for the record (SUM-004). */
  drift?: DriftRecord;
}

/** What a decision definition needs to be shown and resolved: events with choices, and the systems' own. */
export interface DecisionSource {
  id: string;
  choices?: ChoiceDef[];
}

export function lockReason(choice: ChoiceDef, ctx: DecisionContext): string | undefined {
  for (const lock of choice.locks ?? []) {
    const locked = "unless" in lock ? !allHold(lock.unless, ctx) : lock.when(ctx);
    if (locked) return lock.reason;
  }
  return undefined;
}

/** The choices the player can see: those whose requirements hold. */
export const visibleChoices = (def: DecisionSource, ctx: DecisionContext): ChoiceDef[] =>
  (def.choices ?? []).filter((c) => (c.requires ?? []).every((r) => holds(r, ctx)));

/** The chance of each outcome, adding up to 1. */
export function outcomeProbabilities(choice: ChoiceDef, ctx: DecisionContext): number[] {
  const raw = choice.outcomes.map((o) => {
    if (typeof o.p === "number") return o.p;
    if (typeof o.p === "function") return o.p(ctx);
    return (o.p.modifiers ?? []).reduce((w, m) => (allHold(m.when, ctx) ? w * m.multiply : w), o.p.weight);
  });
  const total = raw.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new Error(`Choice ${choice.id}: outcomes have no chance`);
  return raw.map((p) => p / total);
}

/** The lens lines for a choice: its own outcomes when it has more than one, then the lines the engine adds. */
export function lensFor(choice: ChoiceDef, ctx: DecisionContext): ChoiceView["lens"] {
  const lines: LensLine[] = [];
  if (choice.outcomes.length > 1) {
    const probabilities = outcomeProbabilities(choice, ctx);
    choice.outcomes.forEach((outcome, i) => {
      if (outcome.lens) lines.push({ key: outcome.lens, p: probabilities[i]! });
    });
  }
  lines.push(...(choice.lens?.(ctx) ?? []));
  return lines.map((line) => ({
    ...line,
    band: oddsBand(line.p),
    ...(line.vs === undefined ? {} : { vsBand: oddsBand(line.vs) }),
  }));
}

export function choiceViews(def: DecisionSource, ctx: DecisionContext): ChoiceView[] {
  return visibleChoices(def, ctx).map((choice) => {
    const lockedReason = lockReason(choice, ctx);
    const asked = choice.cost?.(ctx);
    const cost = asked && (asked.borneInSchool || ownsMoney(ctx.person)) ? asked : undefined;
    return {
      id: choice.id,
      textKey: choice.text,
      ...(lockedReason ? { lockedReason } : {}),
      ...(cost ? { cost } : {}),
      lens: lensFor(choice, ctx),
    };
  });
}

export interface ResolvedDecision {
  choice: ChoiceDef;
  outcome: OutcomeDef;
  effects: Effect[];
  cause: Cause;
  record: DecisionRecord;
}

/**
 * Takes a choice and rolls its outcome. Always draws exactly one number, so the stream stays in step
 * whatever the choice. A choice with one outcome is the player's doing; one with several is chance
 * shaped by the choice.
 */
export function resolveChoice(def: DecisionSource, choiceId: string, ctx: DecisionContext, rng: Rng): ResolvedDecision {
  const roll = rng.next();
  const choice = visibleChoices(def, ctx).find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Unknown choice: ${choiceId}`);
  const reason = lockReason(choice, ctx);
  if (reason) throw new Error(`Choice ${choiceId} is locked: ${reason}`);
  const probabilities = outcomeProbabilities(choice, ctx);
  let acc = 0;
  let index = probabilities.findIndex((p) => (acc += p) > roll);
  if (index === -1) index = probabilities.length - 1;
  const outcome = choice.outcomes[index]!;
  const effects = typeof outcome.effects === "function" ? outcome.effects(ctx) : [...outcome.effects];
  return {
    choice,
    outcome,
    effects,
    cause: choice.outcomes.length > 1 ? "chance" : "choice",
    record: { choiceId, choiceTextKey: choice.text, outcomeTextKey: outcome.text },
  };
}

/** The choice the auto policy and the calibration harness take: the marked default, else the first open one. */
export function defaultChoiceId(def: DecisionSource, ctx: DecisionContext): string {
  const open = visibleChoices(def, ctx).filter((c) => !lockReason(c, ctx));
  const choice = open.find((c) => c.default) ?? open[0];
  if (!choice) throw new Error(`Decision ${def.id} has no choice that can be taken`);
  return choice.id;
}
