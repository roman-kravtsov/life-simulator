// Parents at birth (FAM-001) and the family growing older and dying (FAM-003).
import { namesForRegion } from "../content/names";
import { normal, clamp } from "./dist";
import type { Rng } from "./rng";
import type { Relationship } from "./types";
import type { Country } from "./world/types";

const MOTHER_AGE_SD = 5.5;
const FATHER_EXTRA_YEARS = { mean: 3.5, sd: 4 };

/**
 * A mother and a father, alive at the birth. Ages centre on the country's mean age at
 * childbirth (the mother) and a few years above it (the father). Orphanhood comes later, as
 * they age and die by the life table.
 */
export function generateParents(family: Rng, country: Country, names: Rng): [Relationship, Relationship] {
  const list = namesForRegion(country.region);
  const motherAge = clamp(Math.round(normal(family, country.demography.meanAgeAtBirth.value, MOTHER_AGE_SD)), 16, 46);
  const fatherAge = Math.max(
    17,
    motherAge + Math.round(normal(family, FATHER_EXTRA_YEARS.mean, FATHER_EXTRA_YEARS.sd)),
  );
  return [
    {
      id: "mother",
      kind: "mother",
      name: list.female[names.int(0, list.female.length - 1)]!,
      sex: "female",
      age: motherAge,
      alive: true,
      closeness: family.int(55, 95),
    },
    {
      id: "father",
      kind: "father",
      name: list.male[names.int(0, list.male.length - 1)]!,
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
