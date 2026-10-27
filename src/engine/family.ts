// Parents at birth (FAM-001), siblings (FAM-002) and the family growing older and dying (FAM-003).
import { namesForRegion } from "../content/names";
import { normal, clamp, poisson } from "./dist";
import { pickName, takenNames } from "./names";
import type { Rng } from "./rng";
import type { Person, Relationship, Sex } from "./types";
import type { Country } from "./world/types";

const MOTHER_AGE_SD = 5.5;
const FATHER_EXTRA_YEARS = { mean: 3.5, sd: 4 };

/**
 * A mother and a father, alive at the birth. Ages centre on the country's mean age at
 * childbirth (the mother) and a few years above it (the father). Orphanhood comes later, as
 * they age and die by the life table.
 */
export function generateParents(
  family: Rng,
  country: Country,
  names: Rng,
  taken: ReadonlySet<string> = new Set(),
): [Relationship, Relationship] {
  const list = namesForRegion(country.region);
  const motherRoll = names.next();
  const fatherRoll = names.next();
  const mother = pickName(list.female, motherRoll, taken);
  const father = pickName(list.male, fatherRoll, new Set([...taken, mother.toLocaleLowerCase()]));
  const motherAge = clamp(Math.round(normal(family, country.demography.meanAgeAtBirth.value, MOTHER_AGE_SD)), 16, 46);
  const fatherAge = Math.max(
    17,
    motherAge + Math.round(normal(family, FATHER_EXTRA_YEARS.mean, FATHER_EXTRA_YEARS.sd)),
  );
  return [
    {
      id: "mother",
      kind: "mother",
      name: mother,
      sex: "female",
      age: motherAge,
      alive: true,
      closeness: family.int(55, 95),
    },
    {
      id: "father",
      kind: "father",
      name: father,
      sex: "male",
      age: fatherAge,
      alive: true,
      closeness: family.int(45, 85),
    },
  ];
}

/** Everyone alive is a year older. Returns new objects; the dead stay as they were. */
export const ageRelatives = (relationships: readonly Relationship[]): Relationship[] =>
  relationships.map((r) => (r.alive ? { ...r, age: r.age + 1 } : r));

/**
 * Rolls each relative's year of death from the life table for their age and sex. Draws once per
 * relative, living or dead, so one death never shifts another relative's roll.
 */
export function rollFamilyDeaths(relationships: readonly Relationship[], country: Country, rng: Rng): Relationship[] {
  return relationships.map((relative) => {
    const roll = rng.next();
    if (!relative.alive) return relative;
    const table = country.demography.lifeTable.value[relative.sex];
    const qx = table[Math.min(relative.age, table.length - 1)]!;
    return roll < qx ? { ...relative, alive: false } : relative;
  });
}

/** The years of a mother's life in which she has children: births come at a steady rate across them. */
export const FERTILE_AGES = [15, 45] as const;
const FERTILE_YEARS = FERTILE_AGES[1] - FERTILE_AGES[0];

/** Births per year to a mother in the fertile years: the total fertility rate spread across them. */
const birthRate = (country: Country) => country.demography.tfr.value / FERTILE_YEARS;

const SIBLING_CLOSENESS = [40, 85] as const;

function sibling(
  country: Country,
  id: string,
  age: number,
  sexRoll: number,
  nameRoll: number,
  closenessRoll: number,
  taken: ReadonlySet<string>,
): Relationship {
  const ratio = country.demography.sexRatioAtBirth.value;
  const sex: Sex = sexRoll < ratio / (1 + ratio) ? "male" : "female";
  return {
    id,
    kind: "sibling",
    name: pickName(namesForRegion(country.region)[sex], nameRoll, taken),
    sex,
    age,
    alive: true,
    closeness: SIBLING_CLOSENESS[0] + Math.floor(closenessRoll * (SIBLING_CLOSENESS[1] - SIBLING_CLOSENESS[0] + 1)),
  };
}

/**
 * Older siblings at the birth. Births to the mother form a steady stream across her fertile years,
 * so the number before this child is Poisson with the rate times the years she had behind her, and
 * each came at a uniform moment among them. Brothers and sisters who died young are not listed, only
 * counted in `lost`, because they were born. Younger siblings come later, year by year (rollSiblingBirth).
 * Each takes a name the person, the parents (`taken`) and the brothers and sisters before them do not have;
 * one who did not live takes none.
 */
export function generateSiblings(
  rng: Rng,
  country: Country,
  motherAge: number,
  taken: ReadonlySet<string> = new Set(),
): { siblings: Relationship[]; lost: number } {
  const years = Math.max(0, Math.min(motherAge, FERTILE_AGES[1]) - FERTILE_AGES[0]);
  const count = poisson(rng, birthRate(country) * years);
  const siblings: Relationship[] = [];
  const names = new Set(taken);
  let lost = 0;
  for (let i = 0; i < count; i++) {
    const age = Math.max(1, Math.round(rng.next() * years));
    const sexRoll = rng.next();
    const survival = rng.next();
    const nameRoll = rng.next();
    const closenessRoll = rng.next();
    const born = sibling(country, `sibling-${i + 1}`, age, sexRoll, nameRoll, closenessRoll, names);
    const table = country.demography.lifeTable.value[born.sex];
    let alive = 1;
    for (let a = 0; a < age; a++) alive *= 1 - table[Math.min(a, table.length - 1)]!;
    if (survival < alive) {
      siblings.push(born);
      names.add(born.name.toLocaleLowerCase());
    } else lost++;
  }
  siblings.sort((a, b) => b.age - a.age);
  return { siblings: siblings.map((s, i) => ({ ...s, id: `sibling-${i + 1}` })), lost };
}

/**
 * A younger sibling this year, if the mother is alive and in her fertile years: the yearly chance is
 * the birth rate of the mother's stream of births. None in the baby's own first year. Always draws
 * four numbers. `reserved` holds the names of relatives the year has already added.
 */
export function rollSiblingBirth(
  person: Person,
  country: Country,
  rng: Rng,
  reserved: readonly string[] = [],
): Relationship | undefined {
  const roll = rng.next();
  const sexRoll = rng.next();
  const nameRoll = rng.next();
  const closenessRoll = rng.next();
  const mother = person.relationships.find((r) => r.kind === "mother");
  if (person.age < 1 || !mother?.alive || mother.age < FERTILE_AGES[0] || mother.age >= FERTILE_AGES[1])
    return undefined;
  if (roll >= 1 - Math.exp(-birthRate(country))) return undefined;
  return sibling(
    country,
    `sibling-born-${person.age}`,
    0,
    sexRoll,
    nameRoll,
    closenessRoll,
    takenNames(person, reserved),
  );
}
