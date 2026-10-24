// How close the people around the person are, and how that changes (REL-001). Closeness runs from
// 0 to 100. Each year it moves part of the way toward a norm that depends on who the relative is and
// how sociable the person is, with a little noise. Events and, from M5, the Bond focus move it too
// (the `relationship` effects in effects.ts).
import { namesForRegion } from "../content/names";
import { clamp } from "./dist";
import type { PendingEvent } from "./events";
import { FOCUS_EFFECT } from "./focus";
import type { Rng } from "./rng";
import type { Person, Relationship, RelationshipKind, Sex } from "./types";
import type { Country } from "./world/types";

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

/** A friend nobody makes time for settles this much lower. */
const UNKEPT_FRIEND = 35;

const RATE = 0.2;
const NOISE = 2.5;

export function closenessNorm(relative: Relationship, person: Person): number {
  let norm = BASE_NORM[relative.kind] + SOCIABILITY_PULL * person.traits.sociability;
  const parent = relative.kind === "mother" || relative.kind === "father";
  if (parent && person.age >= TEEN_AGES[0] && person.age <= TEEN_AGES[1]) norm -= TEEN_DISTANCE;
  // Time with the people who matter keeps them close (Bond); a friend who is not kept up with drifts away.
  const bond = person.focus?.bond ?? 0;
  norm += FOCUS_EFFECT.bond.closeness * bond;
  if (relative.kind === "friend") norm -= UNKEPT_FRIEND * clamp(-bond, 0, 1);
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

// Friends (REL-002) ---------------------------------------------------------------------------------

/** Friends are made from this age. */
export const FRIEND_FROM_AGE = 5;
const MAX_FRIENDS = 6;
/** The yearly chance of making a friend with none yet, before school, work, nature and Bond change it. Authored. */
const FRIEND_CHANCE = 0.2;
/** A friendship that has faded below this closeness ends. */
export const FRIENDSHIP_ENDS_BELOW = 18;

/** The chance of making a friend this year (REL-002): likelier at school and at work, for the sociable, with time for Bond, and less so the more friends there are. */
export function friendChance(person: Person): number {
  if (person.age < FRIEND_FROM_AGE) return 0;
  const friends = person.relationships.filter((r) => r.alive && r.kind === "friend").length;
  const settings = person.education.inSchool
    ? 1.5
    : person.work.status === "employed" || person.work.status === "informal"
      ? 1.2
      : 1;
  const bond = Math.max(0.2, 1 + FOCUS_EFFECT.bond.meeting * (person.focus?.bond ?? 0));
  const sociable = 1 + 0.25 * person.traits.sociability;
  return clamp(FRIEND_CHANCE * settings * bond * sociable * Math.max(0, 1 - friends / MAX_FRIENDS), 0, 0.9);
}

export interface FriendStep {
  person: Person;
  events: PendingEvent[];
}

/**
 * A friend made, and friendships that have faded away. Always draws four numbers (the chance, then
 * the friend's sex, name and closeness).
 */
export function stepFriends(person: Person, country: Country, rng: Rng): FriendStep {
  const roll = rng.next();
  const sexRoll = rng.next();
  const nameRoll = rng.next();
  const closenessRoll = rng.next();
  const events: PendingEvent[] = [];
  let { relationships } = person;

  for (const friend of relationships) {
    if (friend.kind === "friend" && friend.alive && friend.closeness < FRIENDSHIP_ENDS_BELOW) {
      events.push({
        id: "friends.drifted",
        textKey: "event.friends.drifted",
        vars: { friend: friend.name },
        cause: "chance",
        effects: [
          { relationship: "remove", id: friend.id },
          { stat: "belonging", add: -2 },
        ],
      });
      relationships = relationships.filter((r) => r !== friend);
    }
  }

  if (roll < friendChance({ ...person, relationships })) {
    const sex: Sex = sexRoll < 0.5 ? "female" : "male";
    const list = namesForRegion(country.region)[sex];
    const friend: Relationship = {
      id: `friend-${person.age}`,
      kind: "friend",
      name: list[Math.min(list.length - 1, Math.floor(nameRoll * list.length))]!,
      sex,
      age: Math.max(FRIEND_FROM_AGE - 2, person.age + Math.floor(((nameRoll * 7919) % 1) * 5) - 2),
      alive: true,
      closeness: 35 + Math.floor(closenessRoll * 20),
    };
    events.push({
      id: "friends.made",
      textKey: "event.friends.made",
      vars: { friend: friend.name },
      cause: "chance",
      effects: [
        { relationship: "add", relative: friend },
        { stat: "belonging", add: 3 },
      ],
    });
  }
  return { person: { ...person, relationships }, events };
}

// Looking after the family (FAM-005) -----------------------------------------------------------------

/** Yearly chance that a parent or partner of this age falls ill and needs looking after. Authored, rising with age. */
export const illOnset = (age: number): number => clamp(0.0035 * Math.exp((age - 40) / 13.5), 0, 0.2);

/** Yearly chance that an ill relative is well again. Authored. */
export const ILL_RECOVERY = 0.35;

const CARED_FOR: readonly RelationshipKind[] = ["mother", "father", "partner", "spouse"];

/**
 * Parents and partners may fall ill and recover. Draws one number per relative, living or not, so
 * one change never shifts another's roll.
 */
export function stepCare(person: Person, rng: Rng): FriendStep {
  const events: PendingEvent[] = [];
  const relationships = person.relationships.map((relative) => {
    const roll = rng.next();
    if (!relative.alive || !CARED_FOR.includes(relative.kind)) return relative;
    if (relative.ill) {
      if (roll >= ILL_RECOVERY) return relative;
      events.push({
        id: "family.recovered",
        textKey: "event.family.recovered",
        vars: { name: relative.name },
        cause: "chance",
        effects: [{ stat: "happiness", add: 2 }],
      });
      return { ...relative, ill: false };
    }
    if (roll >= illOnset(relative.age)) return relative;
    events.push({
      id: relative.kind === "mother" || relative.kind === "father" ? "family.parent_ill" : "family.partner_ill",
      textKey:
        relative.kind === "mother" || relative.kind === "father"
          ? "event.family.parent_ill"
          : "event.family.partner_ill",
      vars: { name: relative.name },
      cause: "chance",
      effects: [{ stat: "happiness", add: -2 }],
    });
    return { ...relative, ill: true };
  });
  return { person: { ...person, relationships }, events };
}
