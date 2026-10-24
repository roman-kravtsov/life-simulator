// How close the people around the person are, and how that changes (REL-001). Closeness runs from
// 0 to 100. Each year it moves part of the way toward a norm that depends on who the relative is and
// how sociable the person is, with a little noise. Events and, from M5, the Bond focus move it too
// (the `relationship` effects in effects.ts).
import { clamp } from "./dist";
import type { Rng } from "./rng";
import type { Person, Relationship, RelationshipKind } from "./types";

/** The closeness each kind of relationship drifts toward for a person of middling sociability. */
const BASE_NORM: Record<RelationshipKind, number> = {
  mother: 72,
  father: 62,
  sibling: 58,
  partner: 72,
  spouse: 74,
  child: 78,
  friend: 55,
  mentor: 55,
};

/** Each point of sociability moves every norm by this much. */
const SOCIABILITY_PULL = 4;
/** Teenagers pull away from their parents for a few years. */
const TEEN_DISTANCE = 10;
const TEEN_AGES = [12, 17] as const;

const RATE = 0.2;
const NOISE = 2.5;

export function closenessNorm(relative: Relationship, person: Person): number {
  let norm = BASE_NORM[relative.kind] + SOCIABILITY_PULL * person.traits.sociability;
  const parent = relative.kind === "mother" || relative.kind === "father";
  if (parent && person.age >= TEEN_AGES[0] && person.age <= TEEN_AGES[1]) norm -= TEEN_DISTANCE;
  return clamp(norm, 0, 100);
}

/** Closeness a year on. Draws one number per relative, living or dead, so one death never shifts another's roll. */
export function driftCloseness(relationships: readonly Relationship[], person: Person, rng: Rng): Relationship[] {
  return relationships.map((relative) => {
    const noise = (rng.next() - 0.5) * 2 * NOISE;
    if (!relative.alive) return relative;
    const closeness = clamp(
      relative.closeness + RATE * (closenessNorm(relative, person) - relative.closeness) + noise,
      0,
      100,
    );
    return { ...relative, closeness };
  });
}
