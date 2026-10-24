import { catalog as contentCatalog } from "../content/events";
import { conditionCatalog } from "../content/healthConditions";
import { childLabourStatus } from "./checks";
import {
  choiceViews,
  defaultChoiceId,
  resolveChoice,
  type DecisionCard,
  type DecisionContext,
  type DecisionSource,
  type Turn,
} from "./decisions";
import { stepEducation } from "./education";
import { applyEffectsToPerson, type Effect } from "./effects";
import {
  selectEvents,
  pendingFromDef,
  isDecision,
  type EventCatalog,
  type EventDef,
  type PendingEvent,
} from "./events";
import { ageRelatives, rollFamilyDeaths, rollSiblingBirth } from "./family";
import { FOCUS_EFFECT, PLAN_START_AGE, focusUnits, isValidChoice, resolvePlan } from "./focus";
import { stepConditions } from "./health";
import { stepMoney } from "./money";
import { driftCloseness, stepCare, stepFriends } from "./relationships";
import { stepFertility, stepPartnership } from "./partnership";
import { driftStats } from "./drift";
import { drawCause, rollDeath } from "./mortality";
import { generatePerson } from "./person";
import { stream } from "./rng";
import { stageForAge } from "./stages";
import { systemDecision } from "./systemDecisions";
import { stepWork } from "./work";
import {
  DEFAULT_SETTINGS,
  type EventRecord,
  type LifeState,
  type Person,
  type Plan,
  type Relationship,
  type Settings,
  type YearRecord,
} from "./types";
import type { Country } from "./world/types";

// The engine's public API (SIM-001): pure functions, no DOM, no I/O. The caller supplies the
// country's data, so loading stays outside the engine.

export interface NewLifeOptions {
  seed: string;
  country: Country;
  settings?: Partial<Settings>;
}

export type TurnInput =
  /** Lives the next year (more than one while the pace is "quiet-years" and nothing happens). `plan` sets the focus points. */
  | { kind: "continue"; plan?: Plan }
  /** Answers the decision the year is waiting on. */
  | { kind: "choose"; choiceId: string };

export interface TurnResult {
  state: LifeState;
}

export function newLife({ seed, country, settings }: NewLifeOptions): LifeState {
  return {
    seed,
    person: generatePerson(seed, country),
    history: [],
    settings: { ...DEFAULT_SETTINGS, ...settings },
    decisions: [],
  };
}

/** A copy of an object without the named keys. */
function withoutKeys<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

/** The same life with other settings, from the next year on (EVENT-006, TIME-002). */
export const withSettings = (state: LifeState, changes: Partial<Settings>): LifeState => ({
  ...state,
  settings: { ...state.settings, ...changes },
});

/** How much resilience cushions a setback to happiness: each point changes it by this share. */
const RESILIENCE_CUSHION = 0.15;

function cushion(effects: readonly Effect[], person: Person): Effect[] {
  const factor = Math.max(
    0.3,
    (1 - RESILIENCE_CUSHION * person.traits.resilience) * (1 - FOCUS_EFFECT.rest.buffer * (person.focus?.rest ?? 0)),
  );
  return effects.map((effect) =>
    "stat" in effect && effect.stat === "happiness" && effect.add < 0
      ? { ...effect, add: effect.add * factor }
      : effect,
  );
}

/** The text, tone and weight of grief for each kind of relative who dies. */
const GRIEF: Partial<Record<Relationship["kind"], { id: string; key: string; severe: boolean; weight: number }>> = {
  mother: { id: "family.mother_died", key: "event.family.mother_died", severe: false, weight: 1 },
  father: { id: "family.father_died", key: "event.family.father_died", severe: false, weight: 1 },
  child: { id: "family.child_died", key: "event.family.child_died", severe: true, weight: 1.8 },
  partner: { id: "family.partner_died", key: "event.family.partner_died", severe: true, weight: 1.4 },
  spouse: { id: "family.partner_died", key: "event.family.partner_died", severe: true, weight: 1.4 },
  friend: { id: "family.friend_died", key: "event.family.friend_died", severe: false, weight: 0.8 },
};

/** Grief at a death in the family: bigger the closer they were, and lighter for a baby. */
function griefFor(relative: Relationship, age: number): PendingEvent {
  const infant = age < 3 ? 0.3 : 1;
  const kind = GRIEF[relative.kind] ?? {
    id: "family.relative_died",
    key: "event.family.relative_died",
    severe: false,
    weight: 1,
  };
  const parent = relative.kind === "mother" || relative.kind === "father";
  const effects: Effect[] = [
    { stat: "belonging", add: -(3 + relative.closeness * 0.12) * infant * kind.weight },
    { stat: "happiness", add: -(4 + relative.closeness * 0.15) * infant * kind.weight },
  ];
  if (parent || relative.kind === "child") effects.push({ set: `lost_${relative.kind}`, value: true });
  return {
    id: kind.id,
    textKey: kind.key,
    softTextKey: `${kind.key}.soft`,
    vars: { name: relative.name },
    sensitivity: kind.severe ? "severe" : "difficult",
    helpTopic: "grief",
    effects,
    cause: "chance",
  };
}

/** A year with nothing to decide or tell (TIME-002). */
export const isQuietYear = (record: YearRecord): boolean =>
  !record.died && !record.stageChanged && record.events.every((e) => e.quiet === true);

/** Most years one `continue` runs through while they are quiet. */
const MAX_QUIET_RUN = 12;

/** The definition of a decision: the systems' own, or an event from the catalog. */
function decisionSource(id: string, catalog: EventCatalog): (DecisionSource & EventDef) | undefined {
  return systemDecision(id) ?? catalog.get(id);
}

function contextFor(turn: Turn, country: Country): DecisionContext {
  return { person: turn.person, country, payload: turn.decision.payload ?? {} };
}

/** The choices the player faces, with what is locked and the odds lens (DEC-001, DEC-002, DEC-005). */
export function decisionCard(
  state: LifeState,
  country: Country,
  catalog: EventCatalog = contentCatalog,
): DecisionCard | undefined {
  const { turn } = state;
  if (!turn) return undefined;
  const def = decisionSource(turn.decision.eventId, catalog);
  if (!def) throw new Error(`Unknown decision: ${turn.decision.eventId}`);
  const { decision } = turn;
  return {
    eventId: decision.eventId,
    textKey: decision.textKey,
    vars: decision.vars ?? {},
    ...(decision.sensitivity ? { sensitivity: decision.sensitivity } : {}),
    ...(decision.helpTopic ? { helpTopic: decision.helpTopic } : {}),
    ...(decision.dataNote ? { dataNote: decision.dataNote } : {}),
    choices: choiceViews(def, contextFor(turn, country)),
  };
}

/**
 * Steps 2 to 6 of the year (design 3.2): the plan, drift, the statistical checks and event selection.
 * Returns the year finished when nothing needs the player, or the year waiting on a decision.
 */
function beginYear(state: LifeState, plan: Plan | undefined, country: Country, catalog: EventCatalog): LifeState {
  const { seed, settings } = state;
  const year = state.person.age;
  const pending: PendingEvent[] = [];
  let open = true;

  // 2. The plan.
  let stored = state.plan;
  if (plan) {
    if (!isValidChoice(state.person, plan)) throw new Error("That plan does not match the points available");
    stored = { points: plan, custom: true };
  }
  let person: Person = state.person;
  let points: Plan | undefined;
  if (person.age >= PLAN_START_AGE) {
    const view = resolvePlan(person, stored);
    points = view.points;
    person = { ...person, focus: focusUnits(view) };
  } else {
    person = withoutKeys(person, "focus");
  }

  // 3. Baseline drift.
  person = { ...person, stats: driftStats(person, country, stream(seed, "drift", year)) };

  // 4. Statistical checks: family deaths and births, child labour, then school, work, money,
  // conditions and the closeness of the people around the person.
  const relatives = rollFamilyDeaths(person.relationships, country, stream(seed, "family", year));
  relatives.forEach((relative, i) => {
    if (!relative.alive && person.relationships[i]!.alive) pending.push(griefFor(relative, person.age));
  });
  person = { ...person, relationships: relatives };

  const baby = rollSiblingBirth(person, country, stream(seed, "siblings", year));
  if (baby) {
    pending.push({
      id: "family.sibling_born",
      textKey: "event.family.sibling_born",
      vars: { name: baby.name },
      effects: [
        { relationship: "add", relative: baby },
        { stat: "belonging", add: 2 },
      ],
      cause: "chance",
    });
  }

  const working = childLabourStatus(person, country, stream(seed, "labour", year));
  if (working !== (person.flags.childLabour === true)) {
    pending.push(
      working
        ? {
            id: "check.child_labour_starts",
            textKey: "event.check.child_labour_starts",
            tags: ["circumstance"],
            effects: [
              { set: "childLabour", value: true },
              { stat: "happiness", add: -2 },
            ],
            cause: "circumstance",
          }
        : {
            id: "check.child_labour_ends",
            textKey: "event.check.child_labour_ends",
            effects: [{ set: "childLabour", value: false }],
            cause: "circumstance",
          },
    );
  }

  for (const step of [
    () => stepEducation(person, country, stream(seed, "education", year), { open }),
    () => stepWork(person, country, stream(seed, "work", year)),
    () => stepMoney(person, country, stream(seed, "money", year)),
    () => stepConditions(person, country, (id) => stream(seed, `condition:${id}`, year), conditionCatalog, { open }),
    () => stepCare(person, stream(seed, "care", year)),
    () => stepFriends(person, country, stream(seed, "friends", year)),
    () => stepPartnership(person, country, stream(seed, "romance", year), { open }),
    () => stepFertility(person, country, stream(seed, "fertility", year)),
  ]) {
    const result = step();
    person = result.person;
    pending.push(...result.events);
    if (result.events.some((e) => e.ask)) open = false;
  }
  person = { ...person, relationships: driftCloseness(person.relationships, person, stream(seed, "closeness", year)) };

  // 5. Event selection.
  const eventsRng = stream(seed, "events", year);
  const picked = selectEvents({
    catalog,
    person,
    country,
    history: state.history,
    rng: eventsRng,
    rollFor: (name) => stream(seed, name, year),
    softening: settings.softening,
    allowChoices: open,
  });
  const roomForDecision = open;
  for (const def of picked) {
    if (isDecision(def)) {
      if (!open) continue;
      open = false;
    }
    pending.push(pendingFromDef(def, person, country, { rng: eventsRng }));
  }
  // A follow-up that is due is used up, unless it is a decision that had to wait for a free year.
  person = {
    ...person,
    scheduled: person.scheduled.filter((s) => {
      if (s.age > person.age) return true;
      const def = catalog.get(s.id);
      return def !== undefined && isDecision(def) && !roomForDecision;
    }),
  };

  const softened = pending.map((p) => (settings.softening && p.softTextKey ? { ...p, textKey: p.softTextKey } : p));

  // 6. A decision stops the year until the player answers.
  const asking = softened.find((p) => p.ask);
  if (asking) {
    const { ask, ...rest } = asking;
    const turn: Turn = {
      year,
      person,
      pending: softened.filter((p) => p !== asking),
      decision: {
        eventId: ask!.eventId,
        textKey: rest.textKey,
        ...(rest.vars ? { vars: rest.vars } : {}),
        ...(ask!.payload ? { payload: ask!.payload } : {}),
        ...(rest.sensitivity ? { sensitivity: rest.sensitivity } : {}),
        ...(rest.helpTopic ? { helpTopic: rest.helpTopic } : {}),
        ...(rest.dataNote ? { dataNote: rest.dataNote } : {}),
      },
      ...(points ? { plan: points } : {}),
    };
    return { ...state, ...(stored ? { plan: stored } : {}), turn };
  }
  return finishYear(
    { ...state, ...(stored ? { plan: stored } : {}) },
    { year, person, pending: softened, plan: points },
    country,
  );
}

interface YearInProgress {
  year: number;
  person: Person;
  pending: PendingEvent[];
  plan: Plan | undefined;
  /** The decision's own record, once answered. */
  answered?: { pending: PendingEvent };
}

/** Steps 7 to 9: apply the effects, check mortality, record the year. */
function finishYear(state: LifeState, progress: YearInProgress, country: Country): LifeState {
  const { seed } = state;
  const { year, plan } = progress;
  let { person } = progress;
  const events: EventRecord[] = [];
  const all = progress.answered ? [...progress.pending, progress.answered.pending] : progress.pending;

  // 7. Apply effects, softened by resilience and rest, keeping each effect's cause.
  for (const pending of all) {
    const result = applyEffectsToPerson(person, cushion(pending.effects, person), pending.cause, country);
    person = result.person;
    events.push({ ...withoutKeys(pending, "ask", "softTextKey", "cause"), effects: result.applied });
  }

  // 8. Mortality.
  if (rollDeath(person, country, stream(seed, "mortality", year))) {
    const cause = drawCause(country, person.sex, person.age, person.conditions, stream(seed, "cause", year));
    person = { ...person, alive: false };
    return {
      ...state,
      person,
      turn: undefined,
      death: { age: person.age, cause },
      history: [
        ...state.history,
        {
          age: person.age,
          stage: person.stage,
          stageChanged: false,
          stats: { ...person.stats },
          ...(plan ? { plan } : {}),
          events,
          died: true,
        },
      ],
    };
  }

  // 1 (at the year's end). The birthday: the person and family are a year older.
  const stage = stageForAge(person.age + 1);
  const next: Person = { ...person, age: person.age + 1, stage, relationships: ageRelatives(person.relationships) };

  // 9. Record the year.
  return {
    ...withoutKeys(state, "turn"),
    person: next,
    history: [
      ...state.history,
      {
        age: next.age,
        stage,
        stageChanged: stage !== person.stage,
        stats: { ...next.stats },
        ...(plan ? { plan } : {}),
        events,
      },
    ],
  };
}

/** Answers the waiting decision, rolls its outcome and finishes the year. */
function answer(state: LifeState, choiceId: string, country: Country, catalog: EventCatalog): LifeState {
  const { turn } = state;
  if (!turn) throw new Error("No decision is waiting");
  const def = decisionSource(turn.decision.eventId, catalog);
  if (!def) throw new Error(`Unknown decision: ${turn.decision.eventId}`);
  const resolved = resolveChoice(def, choiceId, contextFor(turn, country), stream(state.seed, "outcomes", turn.year));
  const { decision } = turn;
  const pending: PendingEvent = {
    id: decision.eventId,
    textKey: decision.textKey,
    ...(decision.vars ? { vars: decision.vars } : {}),
    ...(decision.sensitivity ? { sensitivity: decision.sensitivity } : {}),
    ...(decision.helpTopic ? { helpTopic: decision.helpTopic } : {}),
    ...(decision.dataNote ? { dataNote: decision.dataNote } : {}),
    decision: resolved.record,
    effects: resolved.effects,
    cause: resolved.cause,
  };
  const logged: LifeState = {
    ...state,
    decisions: [...state.decisions, { year: turn.year, eventId: decision.eventId, choiceId }],
  };
  return finishYear(
    logged,
    { year: turn.year, person: turn.person, pending: turn.pending, plan: turn.plan, answered: { pending } },
    country,
  );
}

/**
 * One step of the game, in the order of design 3.2. A year is the one the person is living at their
 * current age; the birthday comes at its end. `continue` lives the year, and stops with `state.turn`
 * set when there is a decision; `choose` answers it.
 */
export function advance(
  state: LifeState,
  input: TurnInput,
  country: Country,
  catalog: EventCatalog = contentCatalog,
): TurnResult {
  if (!state.person.alive) throw new Error("This life has ended");
  if (input.kind === "choose") return { state: answer(state, input.choiceId, country, catalog) };
  if (input.kind !== "continue") throw new Error(`Unknown input: ${String((input as { kind: string }).kind)}`);
  if (state.turn) throw new Error("A decision is waiting");

  let next = beginYear(state, input.plan, country, catalog);
  for (let run = 1; run < MAX_QUIET_RUN && state.settings.pace === "quiet-years"; run++) {
    const last = next.history.at(-1);
    if (next.turn || !next.person.alive || !last || !isQuietYear(last)) break;
    next = beginYear(next, undefined, country, catalog);
  }
  return { state: next };
}

/**
 * Lives one notable stretch with the default course at every decision: what the calibrated models
 * assume, and what an auto-player or the calibration harness does (DEC-006 builds on it).
 */
export function advanceAuto(
  state: LifeState,
  country: Country,
  catalog: EventCatalog = contentCatalog,
  plan?: Plan,
): LifeState {
  let next = advance(state, { kind: "continue", ...(plan ? { plan } : {}) }, country, catalog).state;
  while (next.turn) {
    const def = decisionSource(next.turn.decision.eventId, catalog);
    if (!def) throw new Error(`Unknown decision: ${next.turn.decision.eventId}`);
    const choiceId = defaultChoiceId(def, contextFor(next.turn, country));
    next = advance(next, { kind: "choose", choiceId }, country, catalog).state;
  }
  return next;
}
