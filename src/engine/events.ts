// Events as typed data (EVENT-001, design 2.3 and 3.4). Content lives in src/content/events and is
// loaded into a catalog indexed by life stage. Selection here covers events that happen to you;
// events with choices wait for decisions (DEC-001, M5) and are skipped until then.
import { allHold, indicatorValue, readIndicator, type Condition } from "./conditions";
import type { Effect } from "./effects";
import type { Rng } from "./rng";
import type { Cause, EventRecord, HelpTopic, LifeStage, Person, Sensitivity } from "./types";
import type { Country } from "./world/types";

export type Chance =
  | { kind: "fixed"; p: number }
  | { kind: "indicator"; path: string; scale?: number }
  | { kind: "weight"; base: number; modifiers?: { when: Condition[]; multiply: number }[] };

export interface Choice {
  id: string;
  text: string;
  requires?: Condition[];
  outcomes: { p: number; effects: Effect[]; text: string }[];
}

export interface EventDef {
  /** Dotted and stable, for example "childhood.a_teacher_notices". */
  id: string;
  stage: LifeStage[];
  /** Major events are drawn from their own pool, at most one a year; minor events, at most two. Default minor. */
  tier?: "major" | "minor";
  conditions?: Condition[];
  chance: Chance;
  once?: boolean;
  cooldownYears?: number;
  /** Why it happens, for the summary. Default "chance"; use "circumstance" for what the world dealt. */
  cause?: Cause;
  tags?: string[];
  sensitivity?: Sensitivity;
  helpTopic?: HelpTopic;
  /** String key in src/content/strings/en.ts. */
  text: string;
  dataNote?: { text: string; path: string };
  choices?: Choice[];
  effects?: Effect[];
}

export interface EventCatalog {
  all: readonly EventDef[];
  get(id: string): EventDef | undefined;
  forStage(stage: LifeStage): readonly EventDef[];
}

export function createCatalog(defs: readonly EventDef[]): EventCatalog {
  const byId = new Map<string, EventDef>();
  const byStage = new Map<LifeStage, EventDef[]>();
  for (const def of defs) {
    if (byId.has(def.id)) throw new Error(`Duplicate event id: ${def.id}`);
    if (def.stage.length === 0) throw new Error(`Event ${def.id} needs at least one stage`);
    if (!def.text) throw new Error(`Event ${def.id} needs a text key`);
    const { chance } = def;
    if (chance.kind === "fixed" && !(chance.p >= 0 && chance.p <= 1)) {
      throw new Error(`Event ${def.id}: probability must be between 0 and 1`);
    }
    if (chance.kind === "weight" && !(chance.base > 0)) throw new Error(`Event ${def.id}: weight must be positive`);
    for (const choice of def.choices ?? []) {
      const total = choice.outcomes.reduce((sum, o) => sum + o.p, 0);
      if (Math.abs(total - 1) > 1e-9) throw new Error(`Event ${def.id}, choice ${choice.id}: outcomes must sum to 1`);
    }
    byId.set(def.id, def);
    for (const stage of def.stage) byStage.set(stage, [...(byStage.get(stage) ?? []), def]);
  }
  return {
    all: defs,
    get: (id) => byId.get(id),
    forStage: (stage) => byStage.get(stage) ?? [],
  };
}

/** Yearly probability of a statistical event (fixed, or read from the country's data). */
export function eventProbability(def: EventDef, person: Person, country: Country): number {
  const { chance } = def;
  if (chance.kind === "fixed") return chance.p;
  if (chance.kind === "indicator") {
    return Math.min(1, Math.max(0, indicatorValue(country, chance.path, person.sex) * (chance.scale ?? 1)));
  }
  throw new Error(`Event ${def.id} has a weight, not a probability`);
}

function eventWeight(def: EventDef, person: Person, country: Country): number {
  const { chance } = def;
  if (chance.kind !== "weight") throw new Error(`Event ${def.id} has no weight`);
  return (chance.modifiers ?? []).reduce(
    (weight, m) => (allHold(m.when, { person, country }) ? weight * m.multiply : weight),
    chance.base,
  );
}

/** Weight of "nothing happens" in each narrative draw, so calm years stay common. */
export const QUIET_WEIGHT = 8;
const MAX_MINOR = 2;

export interface SelectArgs {
  catalog: EventCatalog;
  person: Person;
  country: Country;
  history: readonly { age: number; events: readonly { id: string }[] }[];
  /** Draws the pool picks. */
  rng: Rng;
  /** A separate stream per statistical event, so new content never shifts another event's roll. */
  rollFor?: (eventId: string) => Rng;
}

/** The events that happen this year: statistical events first, then the major and minor draws. */
export function selectEvents({ catalog, person, country, history, rng, rollFor }: SelectArgs): EventDef[] {
  const lastSeen = new Map<string, number>();
  for (const record of history) for (const e of record.events) lastSeen.set(e.id, record.age);
  const ctx = { person, country };

  const eligible = catalog.forStage(person.stage).filter((def) => {
    if (def.choices) return false;
    if (!allHold(def.conditions, ctx)) return false;
    const seen = lastSeen.get(def.id);
    if (seen !== undefined && (def.once || person.age - seen < (def.cooldownYears ?? 0))) return false;
    return true;
  });

  const picked = eligible.filter(
    (def) => def.chance.kind !== "weight" && (rollFor?.(def.id) ?? rng).chance(eventProbability(def, person, country)),
  );

  const pool = (tier: "major" | "minor") =>
    eligible.filter((def) => def.chance.kind === "weight" && (def.tier ?? "minor") === tier);
  const draw = (candidates: EventDef[]): EventDef | undefined => {
    if (candidates.length === 0) return undefined;
    const choice = rng.weighted<EventDef | undefined>(
      [...candidates, undefined],
      [...candidates.map((def) => eventWeight(def, person, country)), QUIET_WEIGHT],
    );
    return choice;
  };

  const major = draw(pool("major"));
  if (major) picked.push(major);
  let minors = pool("minor");
  for (let i = 0; i < MAX_MINOR; i++) {
    const minor = draw(minors);
    if (!minor) continue;
    picked.push(minor);
    minors = minors.filter((def) => def !== minor);
  }
  return picked;
}

/** An event ready to apply: its text, tags and effects, before the effects have run. */
export type PendingEvent = Omit<EventRecord, "effects"> & { effects: Effect[]; cause: Cause };

export function pendingFromDef(def: EventDef, person: Person, country: Country): PendingEvent {
  const pending: PendingEvent = {
    id: def.id,
    textKey: def.text,
    effects: def.effects ?? [],
    cause: def.cause ?? "chance",
  };
  if (def.tags) pending.tags = def.tags;
  if (def.sensitivity) pending.sensitivity = def.sensitivity;
  if (def.helpTopic) pending.helpTopic = def.helpTopic;
  if (def.dataNote) {
    const { value, source, year } = readIndicator(country, def.dataNote.path, person.sex);
    pending.dataNote = { textKey: def.dataNote.text, value, source, year };
  }
  return pending;
}
