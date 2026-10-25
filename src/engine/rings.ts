// The life as growth rings (SUM-002, design 1.3): one ring a year. The thickness follows the year's
// happiness, the colour its theme, and the numbered marks point at the key moments (SUM-003).
import type { AppliedEffect } from "./effects";
import type { EventRecord, Person, RingTheme, YearRecord } from "./types";

export const RING_THEMES: readonly RingTheme[] = ["study", "work", "love", "loss", "illness", "move", "plain"];

/** A ring is never thinner than this share of the thickest, so a bleak year still shows. Authored. */
export const MIN_THICKNESS = 0.2;

/** Ring thickness from 0.2 (happiness 0) to 1 (happiness 100). */
export const ringThickness = (happiness: number): number =>
  MIN_THICKNESS + (1 - MIN_THICKNESS) * (Math.min(100, Math.max(0, happiness)) / 100);

const applied = (events: readonly EventRecord[]): AppliedEffect[] => events.flatMap((e) => e.effects);

const closeKinds = ["partner", "spouse", "child"];

/**
 * What a year was mostly about: a death in the family, then illness, then a partner or child coming
 * into the life, then a move; otherwise what the person was doing, which is school or work, or nothing in particular.
 * Illness also colours the years of living with a condition that has become serious (severity 2 or more).
 */
export function yearTheme(person: Person, events: readonly EventRecord[]): RingTheme {
  const effects = applied(events);
  if (events.some((e) => e.helpTopic === "grief")) return "loss";
  if (
    effects.some(({ effect }) => "condition" in effect && effect.condition === "add") ||
    person.conditions.some((c) => c.severity >= 2)
  ) {
    return "illness";
  }
  if (
    effects.some(
      ({ effect }) =>
        "become" in effect ||
        ("relationship" in effect && effect.relationship === "add" && closeKinds.includes(effect.relative.kind)),
    )
  ) {
    return "love";
  }
  if (effects.some(({ effect }) => "move" in effect)) return "move";
  if (person.education.inSchool || effects.some(({ effect }) => "school" in effect)) return "study";
  if (person.work.status === "employed" || person.work.status === "informal") return "work";
  return "plain";
}

export interface Ring {
  /** The age lived in the year this ring is for. */
  age: number;
  /** 0.2 to 1, from happiness at the end of the year. */
  thickness: number;
  theme: RingTheme;
  /** The number of the key moment this year holds, counted from 1, if it holds one. */
  moment?: number;
}

/** The age lived in a year: the record's age less the birthday at its end, which a death year never reaches. */
export const yearLived = (record: YearRecord): number => (record.died ? record.age : record.age - 1);

export function buildRings(history: readonly YearRecord[], momentAges: readonly number[]): Ring[] {
  return history.map((record) => {
    const age = yearLived(record);
    const moment = momentAges.indexOf(age);
    return {
      age,
      thickness: ringThickness(record.stats.happiness),
      theme: record.theme ?? "plain",
      ...(moment >= 0 ? { moment: moment + 1 } : {}),
    };
  });
}
