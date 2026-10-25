// Reflection prompts and the journal (UI-007, design 3.7). A prompt comes from what happened in a year, never
// from a fixed age; it is a pure function of the years already lived, so it draws nothing from any random
// stream and a replay is not touched by it. The journal is what the player wrote, kept beside the life.
import { reflections } from "../content/reflections";
import type { JournalEntry, LifeState, LifeStage, YearRecord } from "./types";

/** Longest journal line, in characters. */
export const JOURNAL_MAX_LENGTH = 200;

export interface ReflectionDef {
  /** Dotted and stable; a journal line keeps it to say what it answered. */
  id: string;
  /** String key in src/content/strings/en.ts. */
  text: string;
  /** Any event of the year with this id; a "*" stands for any run of characters (`health.*.begins`). */
  events?: string[];
  /** The year the person reaches this stage of life. */
  stage?: Exclude<LifeStage, "infancy">;
  /** Any event of the year that moves the person between countryside and city. */
  effect?: "move";
  /** Offered only the first time it matches in a life; a later match goes to the next prompt in the catalog. */
  first?: boolean;
}

const hasId = (patterns: readonly string[], id: string) =>
  patterns.some((pattern) => {
    const parts = pattern.split("*");
    if (parts.length === 1) return id === pattern;
    const [head, ...rest] = parts;
    const tail = rest.pop()!;
    let at = head!.length;
    if (!id.startsWith(head!) || id.length < at + tail.length || !id.endsWith(tail)) return false;
    for (const part of rest) {
      const found = id.indexOf(part, at);
      if (found < 0 || found + part.length > id.length - tail.length) return false;
      at = found + part.length;
    }
    return at <= id.length - tail.length;
  });

/** Whether what happened in a year is what a prompt is about (ignoring whether it is the first time). */
function matches(def: ReflectionDef, record: YearRecord): boolean {
  if (def.events && record.events.some((event) => hasId(def.events!, event.id))) return true;
  if (def.stage && record.stageChanged && record.stage === def.stage) return true;
  return def.effect === "move" && record.events.some((event) => event.effects.some(({ effect }) => "move" in effect));
}

/**
 * The prompt for the year at `index` of the history: the first of the catalog that fits, or none. One prompt a
 * year at most, so the most personal comes first in the catalog; a quiet year, the empty history and the year a
 * person dies in (the closing passage tells it) have none.
 */
export function reflectionPrompt(
  history: readonly YearRecord[],
  index = history.length - 1,
  catalog: readonly ReflectionDef[] = reflections,
): ReflectionDef | undefined {
  const record = history[index];
  if (!record || record.died) return undefined;
  return catalog.find(
    (def) => matches(def, record) && !(def.first && history.slice(0, index).some((earlier) => matches(def, earlier))),
  );
}

const sameLine = (a: Pick<JournalEntry, "age" | "prompt">, b: Pick<JournalEntry, "age" | "prompt">) =>
  a.age === b.age && a.prompt === b.prompt;

/** The line the player wrote at an age, for a prompt or (with none named) one of their own; for editing it again. */
export const journalLine = (state: LifeState, age: number, prompt?: string): string | undefined =>
  state.journal?.find((entry) => sameLine(entry, { age, prompt }))?.text;

/**
 * The life with a journal line added: tidied, cut to length, replacing the line for the same age and prompt, and
 * removing it when empty. The lines stay in the order of the years.
 */
export function withJournalEntry(state: LifeState, { age, prompt, text }: JournalEntry): LifeState {
  const tidy = Array.from(text.replace(/\s+/g, " ").trim()).slice(0, JOURNAL_MAX_LENGTH).join("").trim();
  const others = (state.journal ?? []).filter((entry) => !sameLine(entry, { age, prompt }));
  const lines = tidy ? [...others, { age, ...(prompt ? { prompt } : {}), text: tidy }] : others;
  // By age; within an age the player's own line comes before the ones that answer a prompt.
  lines.sort((a, b) => a.age - b.age || (a.prompt ?? "").localeCompare(b.prompt ?? ""));
  const next = { ...state };
  delete next.journal;
  return lines.length > 0 ? { ...next, journal: lines } : next;
}
