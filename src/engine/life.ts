import { catalog as contentCatalog } from "../content/events";
import { childLabourStatus } from "./checks";
import { applyEffectsToPerson, type Effect } from "./effects";
import { selectEvents, pendingFromDef, type EventCatalog, type PendingEvent } from "./events";
import { ageRelatives, rollFamilyDeaths } from "./family";
import { driftStats } from "./drift";
import { drawCause, rollDeath } from "./mortality";
import { generatePerson } from "./person";
import { stream } from "./rng";
import { stageForAge } from "./stages";
import type { EventRecord, LifeState, Person, Relationship } from "./types";
import type { Country } from "./world/types";

// The engine's public API (SIM-001): pure functions, no DOM, no I/O. The caller supplies the
// country's data, so loading stays outside the engine.

export interface NewLifeOptions {
  seed: string;
  country: Country;
}

export type TurnInput = { kind: "continue" };

export interface TurnResult {
  state: LifeState;
}

export function newLife({ seed, country }: NewLifeOptions): LifeState {
  return { seed, person: generatePerson(seed, country), history: [] };
}

/** How much resilience cushions a setback to wellbeing: each point changes it by this share. */
const RESILIENCE_CUSHION = 0.15;

function cushion(effects: readonly Effect[], resilience: number): Effect[] {
  return effects.map((effect) =>
    "stat" in effect && effect.stat === "wellbeing" && effect.add < 0
      ? { ...effect, add: effect.add * (1 - RESILIENCE_CUSHION * resilience) }
      : effect,
  );
}

/** Grief at a death in the family: bigger the closer they were, and lighter for a baby. */
function griefFor(relative: Relationship, age: number): PendingEvent {
  const infant = age < 3 ? 0.3 : 1;
  const parent = relative.kind === "mother" || relative.kind === "father";
  const effects: Effect[] = [
    { stat: "bonds", add: -(3 + relative.closeness * 0.12) * infant },
    { stat: "wellbeing", add: -(4 + relative.closeness * 0.15) * infant },
  ];
  if (parent) effects.push({ set: `lost_${relative.kind}`, value: true });
  return {
    id: parent ? `family.${relative.kind}_died` : "family.relative_died",
    textKey: parent ? `event.family.${relative.kind}_died` : "event.family.relative_died",
    vars: { name: relative.name },
    sensitivity: "difficult",
    helpTopic: "grief",
    effects,
    cause: "chance",
  };
}

/**
 * One year of life, in the order of design 3.2. The year is the one the person is living at
 * their current age; the birthday comes at its end. Steps with no system yet (the plan, decisions)
 * arrive in M5.
 */
export function advance(
  state: LifeState,
  input: TurnInput,
  country: Country,
  catalog: EventCatalog = contentCatalog,
): TurnResult {
  if (!state.person.alive) throw new Error("This life has ended");
  if (input.kind !== "continue") throw new Error(`Unknown input: ${String(input.kind)}`);

  const { seed } = state;
  const year = state.person.age;
  const pending: PendingEvent[] = [];

  // 3. Baseline drift.
  let person: Person = { ...state.person, stats: driftStats(state.person, country, stream(seed, "drift", year)) };

  // 4. Statistical checks: family deaths, then child labour.
  const relatives = rollFamilyDeaths(person.relationships, country, stream(seed, "family", year));
  relatives.forEach((relative, i) => {
    if (!relative.alive && person.relationships[i]!.alive) pending.push(griefFor(relative, person.age));
  });
  person = { ...person, relationships: relatives };

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
              { stat: "wellbeing", add: -2 },
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

  // 5. Event selection.
  const eventsRng = stream(seed, "events", year);
  for (const def of selectEvents({
    catalog,
    person,
    country,
    history: state.history,
    rng: eventsRng,
    rollFor: (name) => stream(seed, name, year),
  })) {
    pending.push(pendingFromDef(def, person, country));
  }

  // 7. Apply effects, softened by resilience, keeping each effect's cause.
  const events: EventRecord[] = [];
  for (const { cause, effects, ...rest } of pending) {
    const result = applyEffectsToPerson(person, cushion(effects, person.traits.resilience), cause);
    person = result.person;
    events.push({ ...rest, effects: result.applied });
  }

  // 8. Mortality.
  if (rollDeath(person, country, stream(seed, "mortality", year))) {
    const cause = drawCause(country, person.sex, person.age, person.conditions, stream(seed, "cause", year));
    person = { ...person, alive: false };
    return {
      state: {
        ...state,
        person,
        death: { age: person.age, cause },
        history: [
          ...state.history,
          { age: person.age, stage: person.stage, stageChanged: false, stats: { ...person.stats }, events, died: true },
        ],
      },
    };
  }

  // 1 (at the year's end). The birthday: the person and family are a year older.
  const stage = stageForAge(person.age + 1);
  const next: Person = { ...person, age: person.age + 1, stage, relationships: ageRelatives(person.relationships) };

  // 9. Record the year.
  return {
    state: {
      ...state,
      person: next,
      history: [
        ...state.history,
        { age: next.age, stage, stageChanged: stage !== person.stage, stats: { ...next.stats }, events },
      ],
    },
  };
}
