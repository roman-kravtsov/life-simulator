// The summary of a finished life (SUM-001 to SUM-004): the death, the key facts, the rings, the key
// moments and what shaped the life. A pure function of the finished life and its country, so the
// archive can rebuild it and a test can check it. The words come from the UI and src/content/strings.
import { deathRecord, type DeathRecord } from "./death";
import { DRIFT_FILTER } from "./drift";
import type { AppliedEffect } from "./effects";
import { buildRings, yearLived, type Ring } from "./rings";
import {
  STAT_IDS,
  type Cause,
  type EducationLevel,
  type EventRecord,
  type JournalEntry,
  type LifeState,
  type RingTheme,
  type Sector,
  type Sex,
  type StatId,
  type Stats,
  type YearRecord,
} from "./types";
import type { Country } from "./world/types";

/** Plain facts about the life, for the lines under the passage. */
export interface LifeFacts {
  /** The highest school level completed. */
  education: EducationLevel;
  literate?: boolean;
  yearsWorked: number;
  /** The sector of the last job, if the person ever had one. */
  sector?: Sector;
  children: number;
  siblings: number;
  /** Whether a partner or spouse was ever part of the life. */
  partnered: boolean;
  /** The conditions the person lived with at some time, in the order they began. */
  conditions: string[];
  /** Times the person moved between countryside and city. */
  moves: number;
}

export interface Moment {
  /** The age lived in the year. */
  age: number;
  eventId: string;
  textKey: string;
  vars?: Record<string, string | number>;
  theme: RingTheme;
  /** Set when a decision was made in the year: the line of what the player chose and what came of it. */
  decision?: EventRecord["decision"];
}

/** Moments are chosen from the years: at most this many, at least this many when the life has them. */
export const MOMENTS_MIN = 5;
export const MOMENTS_MAX = 12;
/** A year makes the key moments on its own when it scores at least this much. */
export const MOMENT_THRESHOLD = 4;

const SEVERITY_SCORE = { none: 0, difficult: 2.5, severe: 4 } as const;
const CLOSE_KINDS = ["partner", "spouse", "child"];

/** How much an effect weighs when choosing the key moments. Authored. */
function effectScore({ effect }: AppliedEffect): number {
  if ("condition" in effect) return effect.condition === "add" ? 3 : 1.5;
  if ("become" in effect) return 4;
  if ("relationship" in effect) {
    if (effect.relationship !== "add") return 0;
    return CLOSE_KINDS.includes(effect.relative.kind) ? 3 : 1;
  }
  if ("school" in effect) {
    if (effect.school === "stay") return effect.completes ? 2.5 : 0;
    return 2;
  }
  if ("work" in effect) return 2.5;
  if ("move" in effect) return 2;
  return 0;
}

/** Stat changes of 10 points in total are worth one point, up to three. */
const swingScore = (effects: readonly AppliedEffect[]): number =>
  Math.min(3, effects.reduce((sum, e) => sum + Math.abs(e.delta ?? 0), 0) / 10);

/** How much one event weighs in its year. Quiet texture does not count. */
export function eventScore(event: EventRecord): number {
  if (event.quiet) return 0;
  return (
    1 +
    (event.decision ? 3 : 0) +
    SEVERITY_SCORE[event.sensitivity ?? "none"] +
    event.effects.reduce((sum, e) => sum + effectScore(e), 0) +
    swingScore(event.effects)
  );
}

/** A year's score: its events together, and a little for a new stage of life. */
export function yearScore(record: YearRecord): number {
  return record.events.reduce((sum, e) => sum + eventScore(e), 0) + (record.stageChanged ? 1 : 0);
}

/**
 * The most significant years, in order of age (SUM-003). A year counts on its own when it scores
 * `MOMENT_THRESHOLD` or more; the best of those make up at most `MOMENTS_MAX`, and when fewer than
 * `MOMENTS_MIN` reach the threshold the next best years with something to tell are added, so a life
 * that had five years to tell has five moments. The year of death is left to the closing passage.
 */
export function keyMoments(history: readonly YearRecord[]): Moment[] {
  const candidates = history
    .filter((record) => !record.died && record.events.some((e) => !e.quiet))
    .map((record) => ({ record, score: yearScore(record) }))
    // Highest score first; the earlier year wins a tie.
    .sort((a, b) => b.score - a.score || yearLived(a.record) - yearLived(b.record));
  const strong = candidates.filter((c) => c.score >= MOMENT_THRESHOLD);
  const chosen = candidates.slice(0, Math.min(MOMENTS_MAX, Math.max(MOMENTS_MIN, strong.length)));
  return chosen
    .sort((a, b) => yearLived(a.record) - yearLived(b.record))
    .map(({ record }) => {
      // The headline is the event that weighs most; the first of equals.
      const headline = record.events.reduce((best, e) => (eventScore(e) > eventScore(best) ? e : best));
      return {
        age: yearLived(record),
        eventId: headline.id,
        textKey: headline.textKey,
        ...(headline.vars ? { vars: headline.vars } : {}),
        theme: record.theme ?? "plain",
        ...(headline.decision ? { decision: headline.decision } : {}),
      };
    });
}

export type Shares = Record<Cause, number>;

export interface StatShaping {
  /** How much of what moved the stat came from each cause; sums to 1. */
  shares: Shares;
  /**
   * The cause behind at least half of it. Otherwise "mixed", or "mixedChoice" when no cause had half but
   * choice was still a real part of it (`CHOICE_NOTABLE_SHARE`), so a plan only a little different from
   * the default shows on the summary.
   */
  dominant: Cause | "mixed" | "mixedChoice";
}

export interface Shaping {
  stats: Record<StatId, StatShaping>;
  /** The four stats together, each counting equally. */
  overall: Shares;
}

/** A cause counts as the main one when it is at least this share. */
export const DOMINANT_SHARE = 0.5;

/**
 * Choice is worth saying aloud in a mixed life from this share. Authored from the probe (ADMIN-005): the
 * default course leaves 0 to 5% of a stat to choice (12% at the 90th percentile for skills), a plan with
 * one point moved leaves 15 to 32% of the stat it moves.
 */
export const CHOICE_NOTABLE_SHARE = 0.15;

const CAUSES: readonly Cause[] = ["circumstance", "choice", "chance"];

const causeShares = (totals: Shares): Shares => {
  const sum = totals.circumstance + totals.choice + totals.chance;
  return sum === 0
    ? { circumstance: 1 / 3, choice: 1 / 3, chance: 1 / 3 }
    : { circumstance: totals.circumstance / sum, choice: totals.choice / sum, chance: totals.chance / sum };
};

/**
 * What shaped the life (SUM-004), from the tags on the effects. A stat's level each year is carried on
 * from the year before and pulled toward a norm (drift.ts). The norm differs from a neutral person's
 * by what the person was dealt (circumstance), the plan the player lived by (choice) and conditions
 * (chance); the year's random swing is chance; and each effect of an event or decision carries its own
 * tag. The summary follows each source through the same yearly filter, so every source has its own
 * share of the level, and compares how large each was on average over the life, whether it pushed the
 * stat up or down.
 */
export function shaping(history: readonly YearRecord[]): Shaping {
  const totals = Object.fromEntries(
    STAT_IDS.map((id) => [id, { circumstance: 0, choice: 0, chance: 0 } satisfies Shares]),
  ) as Record<StatId, Shares>;
  for (const id of STAT_IDS) {
    const { keep, gain } = DRIFT_FILTER[id];
    const level: Shares = { circumstance: 0, choice: 0, chance: 0 };
    for (const record of history) {
      const { drift } = record;
      for (const cause of CAUSES) level[cause] = level[cause] * keep + (drift ? gain * drift.norm[cause][id] : 0);
      if (drift) level.chance += drift.noise[id];
      for (const event of record.events) {
        for (const { effect, cause, delta } of event.effects) {
          if ("stat" in effect && effect.stat === id) level[cause] += delta ?? 0;
        }
      }
      for (const cause of CAUSES) totals[id][cause] += Math.abs(level[cause]);
    }
  }
  const stats = Object.fromEntries(
    STAT_IDS.map((id) => {
      const shares = causeShares(totals[id]);
      const [top, share] = (Object.entries(shares) as [Cause, number][]).reduce((a, b) => (b[1] > a[1] ? b : a));
      const moved = totals[id].circumstance + totals[id].choice + totals[id].chance > 0;
      const mixed = moved && shares.choice >= CHOICE_NOTABLE_SHARE ? "mixedChoice" : "mixed";
      return [id, { shares, dominant: share >= DOMINANT_SHARE ? top : mixed } satisfies StatShaping];
    }),
  ) as Record<StatId, StatShaping>;
  const mean = (cause: Cause) => STAT_IDS.reduce((sum, id) => sum + stats[id].shares[cause], 0) / STAT_IDS.length;
  return { stats, overall: { circumstance: mean("circumstance"), choice: mean("choice"), chance: mean("chance") } };
}

function lifeFacts(life: LifeState): LifeFacts {
  const { person, history } = life;
  const effects = history.flatMap((record) => record.events.flatMap((e) => e.effects));
  const conditions: string[] = [];
  for (const { effect } of effects) {
    if ("condition" in effect && effect.condition === "add" && !conditions.includes(effect.id)) {
      conditions.push(effect.id);
    }
  }
  const count = (kinds: string[]) => person.relationships.filter((r) => kinds.includes(r.kind)).length;
  return {
    education: person.education.level,
    ...(person.education.literate === undefined ? {} : { literate: person.education.literate }),
    yearsWorked: person.work.yearsWorked,
    ...(person.work.sector ? { sector: person.work.sector } : {}),
    children: count(["child"]),
    siblings: count(["sibling"]),
    partnered: count(["partner", "spouse"]) > 0,
    conditions,
    moves: effects.filter(({ effect }) => "move" in effect).length,
  };
}

export interface LifeSummary {
  seed: string;
  name: string;
  sex: Sex;
  birthYear: number;
  /** Where the life was lived; `iso2` and `name` are what `countryName` needs. */
  country: Pick<Country, "iso3" | "iso2" | "name">;
  death: DeathRecord;
  facts: LifeFacts;
  rings: Ring[];
  moments: Moment[];
  shaping: Shaping;
  /** The stats at the end of the life. */
  stats: Stats;
  epitaph?: string;
  /** The lines the player wrote along the way (UI-007, SUM-005); absent when there are none. */
  journal?: JournalEntry[];
}

/** The summary of a life that has ended (SUM-001). */
export function summarize(life: LifeState, country: Country): LifeSummary {
  const death = deathRecord(life, country);
  const { person } = life;
  const moments = keyMoments(life.history);
  return {
    seed: life.seed,
    name: person.name,
    sex: person.sex,
    birthYear: person.birthYear,
    country: { iso3: country.iso3, iso2: country.iso2, name: country.name },
    death,
    facts: lifeFacts(life),
    rings: buildRings(
      life.history,
      moments.map((m) => m.age),
    ),
    moments,
    shaping: shaping(life.history),
    stats: person.stats,
    ...(life.epitaph ? { epitaph: life.epitaph } : {}),
    ...(life.journal?.length ? { journal: life.journal } : {}),
  };
}
