// Loads the baked world data from public/data (WORLD-002). Outside the engine because it does I/O.
import type { Country, CountryIndex } from "./engine/world/types";

const url = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(url(path));
  if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

let indexPromise: Promise<CountryIndex> | undefined;

/** The country index, fetched once. A failed fetch is not cached, so the player can retry. */
export function loadIndex(): Promise<CountryIndex> {
  indexPromise ??= getJson<CountryIndex>("index.json").catch((error) => {
    indexPromise = undefined;
    throw error;
  });
  return indexPromise;
}

/** One country's file, loaded on demand. */
export const loadCountry = (iso3: string) => getJson<Country>(`countries/${iso3}.json`);
