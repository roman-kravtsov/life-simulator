// Content validation (ADMIN-001): checks the event and condition definitions against the strings and
// the country schema, and returns every problem found. Pure, so a test can run it in CI over what ships.
import { readIndicator, type Condition } from "./conditions";
import type { EventDef, Role } from "./events";
import type { ChoiceDef, DecisionContext } from "./decisions";
import type { Effect } from "./effects";
import type { ConditionCatalog, ConditionDef } from "./health";
import type { Person, Relationship } from "./types";
import type { Country } from "./world/types";

const ID_FORMAT = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;
const PLACEHOLDER = /\{(\w+)\}/g;
const NOTE_VARIABLES = ["share", "oneIn", "value"];
const ROLES: readonly Role[] = ["friend", "partner", "mother", "father", "sibling", "child", "parent"];

export interface EventValidation {
  events: readonly EventDef[];
  strings: Readonly<Record<string, string>>;
  /** Any country: the paths in notes and conditions must resolve in it. */
  country: Country;
  /** Any person: effects given as functions are run against it. */
  person: Person;
  conditions: Pick<ConditionCatalog, "get">;
  /** Run the functions that make a decision's effects. Off for the engine's own decisions, which need their system's payload. */
  exercise?: boolean;
}

const placeholders = (text: string): string[] => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]!);

/** Every problem found in the events, each saying which event it is in. */
export function validateEvents({
  events,
  strings,
  country,
  person,
  conditions,
  exercise = true,
}: EventValidation): string[] {
  const problems: string[] = [];
  const ids = new Map<string, EventDef>();
  for (const def of events) {
    if (ids.has(def.id)) problems.push(`${def.id}: the id is used twice`);
    ids.set(def.id, def);
  }

  for (const def of events) {
    const bad = (message: string) => problems.push(`${def.id}: ${message}`);
    const key = (what: string, k: string | undefined) => {
      if (k !== undefined && !(k in strings)) bad(`${what} has no text under "${k}"`);
    };
    const path = (what: string, p: string) => {
      for (const sex of ["female", "male"] as const) {
        try {
          readIndicator(country, p, sex);
        } catch {
          bad(`${what} reads "${p}", which is not a sourced number in the country data`);
          return;
        }
      }
    };
    const checkConditions = (what: string, list: readonly Condition[] | undefined) => {
      for (const c of list ?? []) {
        if ("world" in c) path(what, c.world);
        if ("age" in c && c.age[0] > c.age[1]) bad(`${what}: age range ${c.age[0]}-${c.age[1]} is backwards`);
        if ("stat" in c && c.op === "between" && c.value[0] > c.value[1]) bad(`${what}: stat range is backwards`);
      }
    };
    const roles = new Set<string>(def.roles ?? []);
    for (const role of def.roles ?? []) if (!ROLES.includes(role)) bad(`unknown role "${role}"`);

    if (!ID_FORMAT.test(def.id)) bad("the id must be dotted lower case, such as childhood.found_coin");
    if (def.stage.length === 0) bad("needs a stage");
    key("the event", def.text);
    key("the soft telling", def.softText);
    if (def.softText && (!def.sensitivity || def.sensitivity === "none")) {
      bad("a soft telling is used only for a sensitive event");
    }
    // The engine's own decisions are scheduled with no roles: their text takes their system's variables.
    const allowed = (text: string, what: string) => {
      if (def.chance.kind === "scheduled" && !def.roles) return;
      for (const name of placeholders(text)) {
        if (!roles.has(name)) bad(`${what} speaks of {${name}}, but the event has no such role`);
      }
    };
    if (def.text in strings) allowed(strings[def.text]!, "the text");
    if (def.softText && def.softText in strings) allowed(strings[def.softText]!, "the soft telling");

    if (def.chance.kind === "indicator") path("the chance", def.chance.path);
    if (def.chance.kind === "weight") {
      for (const m of def.chance.modifiers ?? []) checkConditions("a modifier", m.when);
    }
    checkConditions("the conditions", def.conditions);

    if (def.dataNote) {
      key("the data note", def.dataNote.text);
      path("the data note", def.dataNote.path);
      const note = strings[def.dataNote.text];
      if (note !== undefined && !NOTE_VARIABLES.some((v) => note.includes(`{${v}}`))) {
        bad(`the data note "${def.dataNote.text}" uses none of {share}, {oneIn} and {value}`);
      }
      if (note !== undefined) {
        for (const name of placeholders(note)) {
          if (!NOTE_VARIABLES.includes(name)) bad(`the data note speaks of {${name}}, which it is not given`);
        }
      }
    }

    if (def.sensitivity && def.sensitivity !== "none" && !def.helpTopic) {
      bad(`a ${def.sensitivity} event needs a help topic`);
    }
    if (def.helpTopic) key("the help topic", `help.${def.helpTopic}`);

    const checkEffect = (effect: Effect | NonNullable<EventDef["effects"]>[number], what: string) => {
      if ("relationship" in effect && effect.relationship === "closeness" && "role" in effect) {
        if (!roles.has(effect.role))
          bad(`${what} moves closeness with the ${effect.role}, which the event does not cast`);
      }
      if ("condition" in effect && !conditions.get(effect.id))
        bad(`${what} names the illness "${effect.id}", which does not exist`);
      if ("care" in effect && !conditions.get(effect.care))
        bad(`${what} names the illness "${effect.care}", which does not exist`);
      if ("schedule" in effect) {
        const target = ids.get(effect.schedule);
        if (!target) bad(`${what} schedules "${effect.schedule}", which does not exist`);
        else if (target.chance.kind !== "scheduled")
          bad(`${what} schedules "${effect.schedule}", which is not a scheduled event`);
      }
    };
    for (const effect of def.effects ?? []) checkEffect(effect, "an effect");

    if (def.choices && (def.effects?.length ?? 0) > 0)
      bad("a decision's effects belong to its choices' outcomes; the event's own effects would be dropped");
    if (def.choices)
      validateChoices(def.choices, {
        bad,
        key,
        checkConditions,
        checkEffect,
        strings,
        country,
        person,
        exercise,
        roles,
      });
  }
  return problems;
}

interface ChoiceTools {
  bad(message: string): void;
  key(what: string, k: string | undefined): void;
  checkConditions(what: string, list: readonly Condition[] | undefined): void;
  checkEffect(effect: Effect, what: string): void;
  strings: Readonly<Record<string, string>>;
  country: Country;
  person: Person;
  exercise: boolean;
  roles: ReadonlySet<string>;
}

function validateChoices(choices: readonly ChoiceDef[], tools: ChoiceTools): void {
  const { bad, key, checkConditions, checkEffect, strings, country, person, exercise, roles } = tools;
  if (choices.length < 2) bad("a decision needs at least two choices");
  if (choices.filter((c) => c.default).length > 1) bad("only one choice can be the default");
  if (!choices.some((c) => !c.requires?.length && !c.locks?.length))
    bad("a decision needs a choice that is always open, or the year could not go on");
  const seen = new Set<string>();
  const roleIds = Object.fromEntries([...roles].map((role) => [role, `${role}-sample`]));
  const sample: Relationship = {
    id: "sample",
    kind: "friend",
    name: "Sam",
    sex: "female",
    age: 30,
    alive: true,
    closeness: 50,
  };
  const ctx: DecisionContext = {
    person: { ...person, relationships: [...person.relationships, sample] },
    country,
    payload: { roleIds, relative: sample },
  };
  for (const choice of choices) {
    if (seen.has(choice.id)) bad(`the choice id "${choice.id}" is used twice`);
    seen.add(choice.id);
    const where = `choice "${choice.id}"`;
    key(where, choice.text);
    for (const placeholder of placeholders(strings[choice.text] ?? "")) {
      if (!roles.has(placeholder)) bad(`${where} speaks of {${placeholder}}, but the event has no such role`);
    }
    for (const r of choice.requires ?? []) checkConditions(where, [r]);
    for (const lock of choice.locks ?? []) {
      key(`${where}'s lock`, lock.reason);
      if ("unless" in lock) checkConditions(where, lock.unless);
    }
    if (choice.outcomes.length === 0) bad(`${where} has no outcomes`);
    const multiple = choice.outcomes.length > 1;
    for (const [i, outcome] of choice.outcomes.entries()) {
      const at = `${where}, outcome ${i + 1}`;
      key(at, outcome.text);
      for (const placeholder of placeholders(strings[outcome.text] ?? "")) {
        if (!roles.has(placeholder)) bad(`${at} speaks of {${placeholder}}, but the event has no such role`);
      }
      if (multiple && !outcome.lens) bad(`${at} needs a lens phrase for the odds`);
      key(`${at}'s lens`, outcome.lens);
      let effects: readonly Effect[] = [];
      if (typeof outcome.effects === "function") {
        if (exercise) {
          try {
            effects = outcome.effects(ctx);
          } catch (error) {
            bad(`${at} cannot be worked out: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } else effects = outcome.effects;
      for (const effect of effects) checkEffect(effect, at);
    }
    if (exercise && choice.cost) {
      try {
        choice.cost(ctx);
      } catch (error) {
        bad(`${where}'s cost cannot be worked out: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (exercise && choice.lens) {
      try {
        choice.lens(ctx);
      } catch (error) {
        bad(`${where}'s lens cannot be worked out: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

/** Every problem found in the health conditions' definitions and strings. */
export function validateConditions({
  conditions,
  strings,
}: {
  conditions: readonly ConditionDef[];
  strings: Readonly<Record<string, string>>;
}): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const def of conditions) {
    if (seen.has(def.id)) problems.push(`${def.id}: the id is used twice`);
    seen.add(def.id);
    const keys = [
      `condition.${def.id}`,
      ...["begins", "worsens", "eases", "ends"].map((suffix) => `event.condition.${def.id}.${suffix}`),
    ];
    for (const k of keys) if (!(k in strings)) problems.push(`${def.id}: no text under "${k}"`);
    if (def.helpTopic && !(`help.${def.helpTopic}` in strings))
      problems.push(`${def.id}: no text under "help.${def.helpTopic}"`);
    if (def.sensitivity && def.sensitivity !== "none" && !def.helpTopic) {
      problems.push(`${def.id}: a ${def.sensitivity} condition needs a help topic`);
    }
    if (def.care && !(def.care.best >= def.care.usual))
      problems.push(`${def.id}: the best care should cost at least the usual`);
  }
  return problems;
}
