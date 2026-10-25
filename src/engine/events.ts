// Events as typed data (EVENT-001, design 2.3 and 3.4). Content lives in src/content/events and is
// loaded into a catalog indexed by life stage. Statistical events are rolled against their own chance,
// narrative events are drawn from the major and minor pools, follow-ups come when they are due, and
// events with choices become decisions (DEC-001) when the year has room for one.
import { allHold, indicatorValue, readIndicator, type Condition } from "./conditions";
import type { ChoiceDef, Payload } from "./decisions";
import type { Effect } from "./effects";
import type { Rng } from "./rng";
import type {
  Cause,
  EventRecord,
  FocusArea,
  HelpTopic,
  LifeStage,
  Person,
  Relationship,
  RelationshipKind,
  Sensitivity,
} from "./types";
import type { Country } from "./world/types";

export type Chance =
  | { kind: "fixed"; p: number }
  /** Never rolled: the event happens only when something schedules it or a system raises it. */
  | { kind: "scheduled" }
  | { kind: "indicator"; path: string; scale?: number }
  | { kind: "weight"; base: number; modifiers?: { when: Condition[]; multiply: number }[] };

/** A person in the life an event can be about; its text can use `{role}` for the name (REL-002). */
export type Role = "friend" | "partner" | "mother" | "father" | "sibling" | "child" | "parent";

const ROLE_KINDS: Record<Role, readonly RelationshipKind[]> = {
  friend: ["friend"],
  partner: ["partner", "spouse"],
  mother: ["mother"],
  father: ["father"],
  sibling: ["sibling"],
  child: ["child"],
  parent: ["mother", "father"],
};

/** The living relatives who can play a role. */
export const livingFor = (person: Person, role: Role): Relationship[] =>
  person.relationships.filter((r) => r.alive && ROLE_KINDS[role].includes(r.kind));

/** An effect an event can aim at the person playing one of its roles. */
export type EventEffect = Effect | { relationship: "closeness"; amount: number; role: Role };

/** Points an effect at the relative who plays the role, once the role is cast. */
export function castEffects(effects: readonly EventEffect[], cast: Partial<Record<Role, string>>): Effect[] {
  return effects.map((effect) => {
    if (!("role" in effect)) return effect;
    const id = cast[effect.role];
    return id === undefined
      ? { relationship: "closeness", amount: 0 }
      : { relationship: "closeness", amount: effect.amount, id };
  });
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
  /** A shorter telling for when softening is on (EVENT-006). */
  softText?: string;
  /** People the text speaks of; the event only happens when each has a living relative to play it. */
  roles?: Role[];
  /** A small moment that does not interrupt a run of quiet years (TIME-002). */
  quiet?: boolean;
  /** The focus area whose points make the event likelier (DEC-003). */
  focus?: FocusArea;
  /** The note's text uses {share}, {oneIn} and {value}; `invert` reads the complement of the indicator. */
  dataNote?: { text: string; path: string; invert?: boolean };
  choices?: ChoiceDef[];
  effects?: EventEffect[];
}

/** An event with choices is a decision the player makes (DEC-001). */
export const isDecision = (def: EventDef) => (def.choices?.length ?? 0) > 0;

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
      const numbers = choice.outcomes.filter((o) => typeof o.p === "number").map((o) => o.p as number);
      if (numbers.length > 0 && numbers.length !== choice.outcomes.length) {
        throw new Error(`Event ${def.id}, choice ${choice.id}: outcomes must all be probabilities or all be weights`);
      }
      for (const p of numbers) {
        if (!Number.isFinite(p) || p < 0 || p > 1) {
          throw new Error(`Event ${def.id}, choice ${choice.id}: each outcome probability must be between 0 and 1`);
        }
      }
      const total = numbers.reduce((sum, p) => sum + p, 0);
      if (numbers.length > 0 && Math.abs(total - 1) > 1e-9) {
        throw new Error(`Event ${def.id}, choice ${choice.id}: outcomes must sum to 1`);
      }
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
  throw new Error(`Event ${def.id} has a weight or is scheduled, not a probability`);
}

/** How much each unit of focus in the event's area changes its weight (DEC-003). */
const FOCUS_AFFINITY = 0.15;

function eventWeight(def: EventDef, person: Person, country: Country): number {
  const { chance } = def;
  if (chance.kind !== "weight") throw new Error(`Event ${def.id} has no weight`);
  const weight = (chance.modifiers ?? []).reduce(
    (w, m) => (allHold(m.when, { person, country }) ? w * m.multiply : w),
    chance.base,
  );
  const units = def.focus ? (person.focus?.[def.focus] ?? 0) : 0;
  return weight * Math.max(0.3, 1 + FOCUS_AFFINITY * units);
}

/**
 * The chance that a narrative draw brings an event at all, when any can happen and nothing weighs on it
 * either way. "Nothing happens" weighs a share of the events' base weights, so writing more events changes
 * which ones come and not how often; a modifier or a focus point that raises an event's weight raises the
 * chance of it happening too.
 */
export const EVENT_SHARE = { major: 0.25, minor: 0.3 } as const;
const MAX_MINOR = 2;
/** After this many years without a major event, the next major draw cannot come up empty (design 3.4). */
export const MAJOR_PACING_YEARS = 4;

export interface SelectArgs {
  catalog: EventCatalog;
  person: Person;
  country: Country;
  history: readonly { age: number; died?: boolean; events: readonly { id: string }[] }[];
  /** Draws the pool picks. */
  rng: Rng;
  /**
   * A separate stream per statistical event (`event:<id>`) and for each pool (`pool:major`,
   * `pool:minor`), so new content never shifts another event's roll or the other pool's picks.
   */
  rollFor?: (name: `event:${string}` | `pool:${string}`) => Rng;
  /** Softening skips severe narrative events (EVENT-006). */
  softening?: boolean;
  /** False when the year already has a decision: events with choices wait. Default true. */
  allowChoices?: boolean;
}

/** The age at which the latest major event happened, or 0. */
function lastMajorAge(catalog: EventCatalog, history: SelectArgs["history"]): number {
  let latest = 0;
  for (const record of history) {
    const lived = record.died ? record.age : record.age - 1;
    if (record.events.some((e) => catalog.get(e.id)?.tier === "major")) latest = Math.max(latest, lived);
  }
  return latest;
}

/**
 * The events that happen this year: follow-ups that are due, then statistical events, then the
 * major and minor draws. A person who has gone MAJOR_PACING_YEARS without a major event gets one if
 * any can happen.
 */
export function selectEvents({
  catalog,
  person,
  country,
  history,
  rng,
  rollFor,
  softening = false,
  allowChoices = true,
}: SelectArgs): EventDef[] {
  const lastSeen = new Map<string, number>();
  // A surviving year is recorded at the age reached; a death at the age lived. Count years lived.
  for (const record of history) {
    for (const e of record.events) lastSeen.set(e.id, record.died ? record.age : record.age - 1);
  }
  const ctx = { person, country };
  const cast = (def: EventDef) => (def.roles ?? []).every((role) => livingFor(person, role).length > 0);
  const open = (def: EventDef) => allowChoices || !isDecision(def);
  const allowed = (def: EventDef) => !(softening && def.sensitivity === "severe" && def.chance.kind === "weight");

  const picked: EventDef[] = [];
  for (const due of person.scheduled.filter((s) => s.age <= person.age)) {
    const def = catalog.get(due.id);
    if (def && open(def) && cast(def) && !(softening && def.sensitivity === "severe")) picked.push(def);
  }

  const eligible = catalog.forStage(person.stage).filter((def) => {
    if (def.chance.kind === "scheduled" || !open(def) || !allowed(def) || !cast(def)) return false;
    if (!allHold(def.conditions, ctx)) return false;
    const seen = lastSeen.get(def.id);
    if (seen !== undefined && (def.once || person.age - seen < (def.cooldownYears ?? 0))) return false;
    return true;
  });

  for (const def of eligible) {
    if (def.chance.kind === "weight") continue;
    if ((rollFor?.(`event:${def.id}`) ?? rng).chance(eventProbability(def, person, country))) picked.push(def);
  }

  const pool = (tier: "major" | "minor") =>
    eligible.filter((def) => def.chance.kind === "weight" && (def.tier ?? "minor") === tier);
  const draw = (source: Rng, candidates: EventDef[], share: number, mustPick: boolean): EventDef | undefined => {
    if (candidates.length === 0) return undefined;
    const weights = candidates.map((def) => eventWeight(def, person, country));
    if (mustPick) return source.weighted(candidates, weights);
    const base = candidates.reduce((sum, def) => sum + (def.chance.kind === "weight" ? def.chance.base : 0), 0);
    return source.weighted<EventDef | undefined>(
      [...candidates, undefined],
      [...weights, (base * (1 - share)) / share],
    );
  };

  const overdue = person.age - lastMajorAge(catalog, history) >= MAJOR_PACING_YEARS;
  const major = draw(rollFor?.("pool:major") ?? rng, pool("major"), EVENT_SHARE.major, overdue);
  if (major) picked.push(major);
  let minors = pool("minor");
  const minorRng = rollFor?.("pool:minor") ?? rng;
  for (let i = 0; i < MAX_MINOR; i++) {
    const minor = draw(minorRng, minors, EVENT_SHARE.minor, false);
    if (!minor) continue;
    picked.push(minor);
    minors = minors.filter((def) => def !== minor);
  }
  return picked;
}

/** An event ready to apply: its text, tags and effects, before the effects have run. */
export type PendingEvent = Omit<EventRecord, "effects"> & {
  effects: Effect[];
  cause: Cause;
  /** The shorter telling used when softening is on. */
  softTextKey?: string;
  /** Set when the event is a decision waiting for the player: the id of its definition. */
  ask?: { eventId: string; payload?: Payload };
};

export interface PendingOptions {
  /** Casts the roles: one draw per role, so the stream stays in step. */
  rng?: Rng;
}

/** The relatives playing the event's roles, drawn one per role. */
export function castRoles(
  def: Pick<EventDef, "roles">,
  person: Person,
  rng?: Rng,
): Partial<Record<Role, Relationship>> {
  const cast: Partial<Record<Role, Relationship>> = {};
  for (const role of def.roles ?? []) {
    const candidates = livingFor(person, role);
    const roll = rng ? rng.next() : 0;
    cast[role] = candidates[Math.min(candidates.length - 1, Math.floor(roll * candidates.length))];
  }
  return cast;
}

export function pendingFromDef(
  def: EventDef,
  person: Person,
  country: Country,
  { rng }: PendingOptions = {},
): PendingEvent {
  const cast = castRoles(def, person, rng);
  const ids = Object.fromEntries(Object.entries(cast).map(([role, r]) => [role, r!.id])) as Partial<
    Record<Role, string>
  >;
  const vars = Object.fromEntries(Object.entries(cast).map(([role, r]) => [role, r!.name]));
  const pending: PendingEvent = {
    id: def.id,
    textKey: def.text,
    effects: castEffects(def.effects ?? [], ids),
    cause: def.cause ?? "chance",
  };
  if (Object.keys(vars).length > 0) pending.vars = vars;
  if (def.tags) pending.tags = def.tags;
  if (def.sensitivity) pending.sensitivity = def.sensitivity;
  if (def.helpTopic) pending.helpTopic = def.helpTopic;
  if (def.softText && def.sensitivity && def.sensitivity !== "none") pending.softTextKey = def.softText;
  if (def.quiet) pending.quiet = true;
  if (isDecision(def)) pending.ask = { eventId: def.id, payload: { roleIds: ids } };
  if (def.dataNote) {
    // An estimate (filled from a region or income group) is never shown as a fact about the country.
    const { value, source, year, estimated } = readIndicator(country, def.dataNote.path, person.sex);
    if (!estimated)
      pending.dataNote = { textKey: def.dataNote.text, value: def.dataNote.invert ? 1 - value : value, source, year };
  }
  return pending;
}
