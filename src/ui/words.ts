// Small pieces of player-facing text that several screens build from data: odds in words, the data
// note under a story line, and the quiet-years line. Everything goes through t() and format.ts.
import type { OddsBand } from "../engine/decisions";
import type { CountryIndex } from "../engine/world/types";
import type { EventRecord, YearRecord } from "../engine/types";
import { formatNumber, formatPercent, pluralKey } from "../format";
import { hasString, t } from "../i18n";
import type { QuietRun } from "./store";

/** Odds as the lens speaks them (DEC-005): "about 1 in 3", never a decimal or a percentage. */
export function oddsWords(band: OddsBand): string {
  if (band.kind === "fraction") return t("odds.fraction", { num: formatNumber(band.num), den: formatNumber(band.den) });
  return t(`odds.${band.kind}`);
}

/** The data note with its source and year (EVENT-005). The string may use {share}, {oneIn} or {value}. */
export function dataNoteLine(
  note: NonNullable<EventRecord["dataNote"]>,
  sources: CountryIndex["sources"],
  translate: typeof t = t,
): string {
  const { value } = note;
  return translate("life.note", {
    note: translate(note.textKey, {
      share: formatPercent(value),
      oneIn: formatNumber(value > 0 ? Math.round(1 / value) : 0),
      value: formatNumber(value, undefined, { maximumFractionDigits: 1 }),
    }),
    source: sources[note.source]?.title ?? note.source,
    year: note.year,
  });
}

/** "Years 12 to 15 pass quietly." (TIME-002) */
export function quietRunLine({ from, to }: QuietRun): string {
  return t(pluralKey("life.quietRun", to - from + 1), { age: from, from, to });
}

/** The year's thickness in words, from the four bands the ring table uses: thin rings are hard years (SUM-002). */
export function ringFeltKey(thickness: number): string {
  if (thickness < 0.4) return "ring.felt.hard";
  if (thickness < 0.6) return "ring.felt.heavy";
  if (thickness < 0.8) return "ring.felt.gentle";
  return "ring.felt.happy";
}

/** A source named in words, as the data notes name it: its title, or its id when the index does not have it. */
export const sourceTitle = (id: string, sources: CountryIndex["sources"]): string => sources[id]?.title ?? id;

/** "41 years", or "less than a year" for a life that did not reach its first birthday. */
export function yearsWords(years: number): string {
  if (years < 1) return t("summary.years.underOne");
  return t(pluralKey("common.years", Math.round(years)), { count: formatNumber(Math.round(years)) });
}

/**
 * Shares as whole percentages that add up to exactly 100 (largest remainder), so a line that gives all
 * three never reads 99%.
 */
export function wholePercents<K extends string>(shares: Record<K, number>): Record<K, number> {
  const keys = Object.keys(shares) as K[];
  const floors = keys.map((key) => Math.floor(shares[key] * 100));
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = keys
    .map((key, i) => ({ i, rest: shares[key] * 100 - floors[i]! }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]!++;
    left--;
  }
  return Object.fromEntries(keys.map((key, i) => [key, floors[i]!])) as Record<K, number>;
}

/**
 * A string, or null when its key or one of its variables is missing. Lives that were saved earlier name keys
 * and variables by text, so a version of the game without one must leave that line out rather than fail.
 */
export function tryT(key: string, vars?: Parameters<typeof t>[1]): string | null {
  try {
    return t(key, vars);
  } catch {
    return null;
  }
}

/** The cause of death in words, or "a cause not listed here" when this version has no words for it. */
export const causeWords = (cause: string): string => t(hasString(`cause.${cause}`) ? `cause.${cause}` : "cause.other");

/**
 * An earlier year as one paragraph for the ledger (UI-004): the new chapter if one began, then what happened, with what
 * the player chose and what came of it, and "A quiet year." when there is nothing to tell. A year saved by another
 * version may name text this one lacks; those lines are left out.
 */
export function yearText(record: YearRecord): string {
  const parts: string[] = [];
  const stage = record.stageChanged ? tryT(`life.stage.${record.stage}`) : null;
  if (stage !== null) parts.push(t("life.stageReached", { stage }));
  for (const event of record.events) {
    const text = tryT(event.textKey, event.vars);
    if (text === null) continue;
    parts.push(text);
    const { decision } = event;
    if (!decision) continue;
    const choice = tryT(decision.choiceTextKey, event.vars);
    const outcome = tryT(decision.outcomeTextKey, event.vars);
    if (choice !== null && outcome !== null) parts.push(`${t("decision.chose", { choice })}.`, outcome);
  }
  return parts.length === 0 ? t("life.quietYear") : parts.join(" ");
}
