// Partners, marriage and children (REL-003, REL-004, FAM-004).
//
// Marriage age. Each person is dealt a fixed draw at birth (Person.marriageDraw) that places them in
// their country's spread of ages at first marriage, so the country's mean age holds for its people and
// nobody flickers between partners from one year to the next. The spread is lognormal above age 12 with
// the published mean age at first marriage for the person's sex and, for the lower tail, the published
// share of women married before 18. A small share never marries (authored). Sociability and time spent
// on Belonging bring the wedding a little earlier, and a declined partner puts it off.
//
// The course of a courtship: a year before the wedding age a possible partner appears and the player
// accepts or declines (REL-003); at the wedding age the partner becomes a spouse (REL-004). Where the
// wedding age is under 18 there is no courtship: a marriage is arranged and the player can ask to wait,
// with odds the card shows. Whoever the player is, a partner is of the other sex (see docs/design.md).
//
// Children. Births come to a partnered woman, or to the partner of a partnered man, at a yearly chance
// that follows the shape of age-specific fertility around the country's mean age at birth and is scaled
// so that women who live through the fertile years have the country's total fertility rate.
import { namesForRegion } from "../content/names";
import { clamp, normal, normalCdf, normalQuantile } from "./dist";
import { FOCUS_EFFECT } from "./focus";
import type { PendingEvent } from "./events";
import type { Rng } from "./rng";
import type { Person, Relationship, Sex } from "./types";
import type { Country } from "./world/types";

/** Share of people who never marry. Authored: the source gives the mean age of those who do. */
export const NEVER_MARRY = 0.06;

/** Marriage ages are 12 plus a lognormal spread. */
const BASE_AGE = 12;
const MAX_AGE = 60;
const MIN_SPREAD = 0.05;
const MAX_SPREAD = 1.2;
/** Nobody courts or marries before this age. */
export const MIN_COURTING_AGE = 14;
/** A wedding age under this is an arranged marriage with no courtship. */
export const ADULT_AGE = 18;

/** Years put off by each sociability point lost, and by each unit of Belonging focus. Symmetric, so the mean holds. */
const SOCIABILITY_YEARS = 0.4;

export const oppositeSex = (sex: Sex): Sex => (sex === "female" ? "male" : "female");

interface MarriageModel {
  mu: number;
  sigma: number;
}

const models = new WeakMap<Country, Map<Sex, MarriageModel>>();

/** The lognormal part of the spread, solved so that its mean is the published one and the female share under 18 matches. */
function buildModel(country: Country, sex: Sex): MarriageModel {
  const mean = (s: Sex) => Math.max(1, clamp(country.family.meanAgeFirstMarriage.value[s], 14, 50) - BASE_AGE);
  // Weddings are held at whole ages, so "before 18" is an age below 17.5; and those who never marry are not in the spread.
  const under18 = clamp(country.family.childMarriageBy18.value / (1 - NEVER_MARRY), 0.002, 0.6);
  const m = mean("female");
  const share = (sigma: number) =>
    normalCdf((Math.log(ADULT_AGE - 0.5 - BASE_AGE) - Math.log(m) + (sigma * sigma) / 2) / sigma);
  // The share under 18 is not monotonic in the spread when the mean sits close to the threshold, so search the whole range.
  let sigma = MIN_SPREAD;
  let best = Infinity;
  for (let candidate = MIN_SPREAD; candidate <= MAX_SPREAD + 1e-9; candidate += 0.005) {
    const error = Math.abs(share(candidate) - under18);
    if (error < best - 1e-9) {
      best = error;
      sigma = candidate;
    }
  }
  return { mu: Math.log(mean(sex)) - (sigma * sigma) / 2, sigma };
}

function modelFor(country: Country, sex: Sex): MarriageModel {
  let bySex = models.get(country);
  if (!bySex) models.set(country, (bySex = new Map()));
  let model = bySex.get(sex);
  if (!model) bySex.set(sex, (model = buildModel(country, sex)));
  return model;
}

/** The age at which a person with this draw marries, or null if they never do. */
export function marriageAge(draw: number, sex: Sex, country: Country): number | null {
  if (draw >= 1 - NEVER_MARRY) return null;
  const { mu, sigma } = modelFor(country, sex);
  return Math.min(MAX_AGE, BASE_AGE + Math.exp(mu + sigma * normalQuantile(draw / (1 - NEVER_MARRY))));
}

/** The share of a cohort that has married by `age` (inclusive). */
export function shareMarriedBy(age: number, sex: Sex, country: Country): number {
  if (age <= BASE_AGE) return 0;
  const { mu, sigma } = modelFor(country, sex);
  return (1 - NEVER_MARRY) * normalCdf((Math.log(age - BASE_AGE) - mu) / sigma);
}

/** The age this person will marry at, given their traits, their focus and any partner they turned away; null if never. */
export function weddingAge(person: Person, country: Country): number | null {
  const base = marriageAge(person.marriageDraw, person.sex, country);
  if (base === null) return null;
  const delay = Number(person.flags.marriageDelay ?? 0);
  // An arranged marriage is not brought forward by the person's nature; and a courtship never starts one.
  if (base < ADULT_AGE - 0.5) return Math.max(MIN_COURTING_AGE, Math.round(base + delay));
  const earlier =
    SOCIABILITY_YEARS * person.traits.sociability + FOCUS_EFFECT.belonging.meeting * 2 * (person.focus?.belonging ?? 0);
  return Math.max(ADULT_AGE, Math.round(base - earlier + delay));
}

const livingPartner = (person: Person): Relationship | undefined =>
  person.relationships.find((r) => r.alive && (r.kind === "partner" || r.kind === "spouse"));

export const MEET_DECISION = "rel.meet_partner";
export const YOUNG_MARRIAGE_DECISION = "rel.young_marriage";

/** A possible partner: of the other sex, of the age the country's marriages suggest, a stranger become a friend of the heart. */
export function makePartner(person: Person, country: Country, rolls: Rng): Relationship {
  const sex = oppositeSex(person.sex);
  const list = namesForRegion(country.region)[sex];
  const gap = country.family.meanAgeFirstMarriage.value[sex] - country.family.meanAgeFirstMarriage.value[person.sex];
  const age = Math.max(MIN_COURTING_AGE, Math.round(person.age + gap + normal(rolls, 0, 2)));
  return {
    // Unique by age, so a partner who died before the wedding does not keep a later one from being added.
    id: `partner-${person.age}`,
    kind: "partner",
    name: list[Math.min(list.length - 1, Math.floor(rolls.next() * list.length))]!,
    sex,
    age,
    alive: true,
    closeness: 55 + Math.floor(rolls.next() * 21),
  };
}

export interface PartnershipStep {
  person: Person;
  events: PendingEvent[];
}

/**
 * One year of courtship and marriage. Always draws four numbers (the partner's age takes two, then name and
 * closeness) so the stream stays in step whatever the person's situation. When there is no room for
 * a decision (`open` is false) a meeting waits for next year.
 */
export function stepPartnership(
  person: Person,
  country: Country,
  rng: Rng,
  { open = false }: { open?: boolean } = {},
): PartnershipStep {
  const candidate = makePartner(person, country, rng);
  const none: PartnershipStep = { person, events: [] };
  const wed = weddingAge(person, country);
  if (wed === null || person.flags.married === true || person.age < MIN_COURTING_AGE) return none;
  const partner = livingPartner(person);

  if (partner) {
    if (partner.kind !== "partner" || person.age < wed) return none;
    return {
      person,
      events: [
        {
          id: "rel.marriage",
          textKey: "event.rel.marriage",
          vars: { partner: partner.name },
          cause: "chance",
          effects: [
            { become: "spouse", id: partner.id },
            { set: "married", value: true },
            { set: "marriedAt", value: person.age },
            { stat: "happiness", add: 4 },
            { stat: "belonging", add: 5 },
          ],
        },
      ],
    };
  }

  if (wed < ADULT_AGE) {
    if (person.age < wed) return none;
    // With no room for a question this year, the marriage goes ahead as it would if the plea were not made.
    if (!open) {
      return {
        person,
        events: [
          {
            id: "rel.young_marriage_arranged",
            textKey: "event.rel.young_marriage_arranged",
            vars: { partner: candidate.name },
            sensitivity: "difficult",
            helpTopic: "abuse",
            cause: "circumstance",
            effects: [
              { relationship: "add", relative: { ...candidate, kind: "spouse" } },
              { set: "married", value: true },
              { set: "marriedAt", value: person.age },
              { stat: "happiness", add: -3 },
              { stat: "belonging", add: 1 },
            ],
          },
        ],
      };
    }
    return {
      person,
      events: [
        {
          id: YOUNG_MARRIAGE_DECISION,
          textKey: "event.rel.young_marriage",
          vars: { partner: candidate.name },
          sensitivity: "difficult",
          helpTopic: "abuse",
          cause: "circumstance",
          effects: [],
          ask: { eventId: YOUNG_MARRIAGE_DECISION, payload: { relative: { ...candidate, kind: "spouse" } } },
        },
      ],
    };
  }
  if (person.age < wed - 1 || !open) return none;
  return {
    person,
    events: [
      {
        id: MEET_DECISION,
        textKey: "event.rel.meet_partner",
        vars: { partner: candidate.name },
        cause: "chance",
        effects: [],
        ask: { eventId: MEET_DECISION, payload: { relative: candidate } },
      },
    ],
  };
}

/** The chance that the player's pleading to wait puts off an arranged marriage (REL-004). Authored. */
export function waitOdds(person: Person): number {
  return clamp(
    0.25 +
      0.003 * (person.money.householdPercentile - 50) +
      0.06 * person.traits.aptitude +
      (person.education.inSchool ? 0.15 : 0),
    0.05,
    0.75,
  );
}

/** Years an arranged marriage is put off when the plea works, and a declined partner puts off the wedding. */
export const YOUNG_MARRIAGE_DELAY = 3;
export const DECLINED_DELAY = 2;

// Fertility ---------------------------------------------------------------------------------------

export const FERTILE_FROM = 15;
export const FERTILE_TO = 44;
/** Spread of ages at which women have children around the mean (the same used for the mother's age at the birth). */
const BIRTH_AGE_SD = 5.5;
/** No couple has more than this chance of a birth in a year. */
const MAX_BIRTH_CHANCE = 0.6;

const shape = (age: number, mean: number) => Math.exp(-0.5 * ((age - mean) / BIRTH_AGE_SD) ** 2);

const scales = new WeakMap<Country, number>();

/**
 * The factor that turns the shape of fertility by age into a yearly chance of a birth to a partnered
 * woman: solved so that a woman who lives through the fertile years, partnered in the share of them
 * the country's marriage ages give, has the country's total fertility rate in children.
 */
export function fertilityScale(country: Country): number {
  let scale = scales.get(country);
  if (scale === undefined) {
    const mean = country.demography.meanAgeAtBirth.value;
    let exposure = 0;
    for (let age = FERTILE_FROM; age <= FERTILE_TO; age++) {
      exposure += shareMarriedBy(age + 1, "female", country) * shape(age, mean);
    }
    scale = exposure > 0 ? country.demography.tfr.value / exposure : 0;
    scales.set(country, scale);
  }
  return scale;
}

/** The chance a partnered woman of this age has a child this year. */
export function birthChance(motherAge: number, country: Country): number {
  if (motherAge < FERTILE_FROM || motherAge > FERTILE_TO) return 0;
  return Math.min(
    MAX_BIRTH_CHANCE,
    fertilityScale(country) * shape(motherAge, country.demography.meanAgeAtBirth.value),
  );
}

/**
 * A child this year, to the person if she is a partnered woman, or to the partner of a partnered man.
 * Always draws four numbers.
 */
export function stepFertility(person: Person, country: Country, rng: Rng): PartnershipStep {
  const roll = rng.next();
  const sexRoll = rng.next();
  const nameRoll = rng.next();
  const closenessRoll = rng.next();
  const partner = livingPartner(person);
  if (!partner) return { person, events: [] };
  const mother = person.sex === "female" ? person : partner;
  if (mother.sex !== "female" || roll >= birthChance(mother.age, country)) return { person, events: [] };
  const ratio = country.demography.sexRatioAtBirth.value;
  const sex: Sex = sexRoll < ratio / (1 + ratio) ? "male" : "female";
  const list = namesForRegion(country.region)[sex];
  const child: Relationship = {
    id: `child-${person.age}`,
    kind: "child",
    name: list[Math.min(list.length - 1, Math.floor(nameRoll * list.length))]!,
    sex,
    age: 0,
    alive: true,
    closeness: 70 + Math.floor(closenessRoll * 26),
  };
  return {
    person,
    events: [
      {
        id: "family.child_born",
        textKey: "event.family.child_born",
        vars: { name: child.name },
        cause: "chance",
        effects: [
          { relationship: "add", relative: child },
          { stat: "belonging", add: 4 },
          { stat: "happiness", add: 4 },
        ],
      },
    ],
  };
}
