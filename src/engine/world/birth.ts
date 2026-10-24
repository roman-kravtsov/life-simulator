import type { Rng } from "../rng";
import type { CountryIndex, CountryIndexEntry } from "./types";

/** Picks a birth country weighted by annual births across included countries (WORLD-005). */
export function drawBirthCountry(index: CountryIndex, rng: Rng): CountryIndexEntry {
  if (index.countries.length === 0) throw new Error("The country index is empty");
  return rng.weighted(
    index.countries,
    index.countries.map((c) => c.birthsPerYear),
  );
}
