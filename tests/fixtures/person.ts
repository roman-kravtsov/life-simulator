// SYNTHETIC test fixture: an invented person for engine tests.
import type { Person } from "../../src/engine/types";

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
    ...overrides,
  };
}
