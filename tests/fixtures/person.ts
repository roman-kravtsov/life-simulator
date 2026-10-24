// SYNTHETIC test fixture: an invented person for engine tests.
import { adultPercentile } from "../../src/engine/money";
import type { Person } from "../../src/engine/types";
import type { Country } from "../../src/engine/world/types";

/** A person's money at one household percentile, with the current standing equal to it. */
export const moneyAt = (percentile: number, extra: Partial<Person["money"]> = {}): Person["money"] => ({
  householdPercentile: percentile,
  percentile,
  luck: 0,
  savings: 0,
  debt: 0,
  ...extra,
});

export function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    name: "Test",
    sex: "female",
    birthYear: 2023,
    countryIso3: "AAA",
    age: 10,
    stage: "childhood",
    alive: true,
    traits: { temperament: 0, curiosity: 0, resilience: 0, sociability: 0, aptitude: 0, constitution: 0 },
    stats: { health: 70, happiness: 60, belonging: 60, skills: 20 },
    location: "urban",
    education: { level: "none", inSchool: false, years: 0 },
    work: { status: "child", yearsWorked: 0, attachment: 0.5 },
    money: moneyAt(50),
    relationships: [],
    conditions: [],
    flags: {},
    marriageDraw: 0.5,
    scheduled: [],
    ...overrides,
  };
}

/**
 * An independent adult whose own standing, as the engine works it out, is exactly `percentile`:
 * the luck is searched for, so panel tests can name the income without restating the model.
 */
export function adultAt(percentile: number, country: Country, overrides: Partial<Person> = {}): Person {
  const at = (luck: number) => makePerson({ age: 30, ...overrides, money: moneyAt(percentile, { luck }) });
  let [low, high] = [-8, 8];
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (adultPercentile(at(mid), country) < percentile) low = mid;
    else high = mid;
  }
  const person = at(high);
  if (adultPercentile(person, country) !== percentile) throw new Error(`No luck gives percentile ${percentile}`);
  return { ...person, money: { ...person.money, percentile } };
}
