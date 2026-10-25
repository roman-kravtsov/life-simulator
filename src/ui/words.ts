// Small pieces of player-facing text that several screens build from data: odds in words, the data
// note under a story line, and the quiet-years line. Everything goes through t() and format.ts.
import type { OddsBand } from "../engine/decisions";
import type { CountryIndex } from "../engine/world/types";
import type { EventRecord } from "../engine/types";
import { formatNumber, formatPercent, pluralKey } from "../format";
import { t } from "../i18n";
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
