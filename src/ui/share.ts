// Keeping and sharing a finished life (SHARE-001): the few lines of text that are copied. Pure: a function of the
// summary and the strings, so it is tested without a browser. The picture is shareCard.ts.
import { SITE_URL } from "../content/site";
import { exportFileName } from "../engine/save";
import type { LifeSummary } from "../engine/summary";
import { countryName, formatPercent } from "../format";
import { t } from "../i18n";
import { causeWords, wholePercents, yearsWords } from "./words";

/**
 * Causes not named in what leaves the game: a death by suicide, where no help can stand beside the words, and one this
 * version has no words for, which out of context would read as a fault.
 */
const UNNAMED_CAUSES: readonly string[] = ["selfHarm", "other"];

/** How the life ended in one line, for the text and the picture: the age, and the cause where it is named. */
export function diedLine({ death }: LifeSummary): string {
  const cause = UNNAMED_CAUSES.includes(death.cause) ? null : causeWords(death.cause);
  if (death.age < 1) return cause === null ? t("share.text.diedInfant") : t("share.text.diedInfantOf", { cause });
  return cause === null ? t("share.text.diedAt", { age: death.age }) : t("summary.died", { age: death.age, cause });
}

/** The three shares across the stats, as whole percentages that add up to 100. */
export function shareShares(summary: LifeSummary) {
  const percents = wholePercents(summary.shaping.overall);
  return {
    circumstance: formatPercent(percents.circumstance / 100),
    choice: formatPercent(percents.choice / 100),
    chance: formatPercent(percents.chance / 100),
  };
}

/**
 * A short text about the life: who, where and when, how it ended, how long against what is expected there, what
 * shaped it, the player's few words if they left any, and where the game is. Plain lines, no markup.
 */
export function shareText(summary: LifeSummary): string {
  const { death, name, sex, seed, epitaph } = summary;
  const { expectancy } = death;
  const country = countryName(summary.country);
  const lines = [
    t("share.text.who", { name, country, born: summary.birthYear, died: death.year }),
    diedLine(summary),
    t(`share.text.expectancy.${expectancy.verdict}`, {
      country,
      someone: t(`summary.someone.${sex}`),
      expected: yearsWords(expectancy.expected),
      difference: yearsWords(Math.abs(expectancy.difference)),
    }),
    t("share.text.shaped", shareShares(summary)),
  ];
  if (epitaph) lines.push(t("share.text.epitaph", { epitaph }));
  lines.push(`${t("share.text.about")} ${SITE_URL}`, t("share.text.seed", { seed }));
  return lines.join("\n");
}

/** The picture's file name: the same as the life's file, a picture instead of the save. */
export const shareFileName = (seed: string): string => exportFileName({ seed }).replace(/\.json$/, ".png");
