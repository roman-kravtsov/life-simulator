// SYNTHETIC test fixture: an invented person for engine tests.
import type { Person } from "../../src/engine/types";

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
    stats: { health: 70, wellbeing: 60, bonds: 60, skills: 20 },
    location: "urban",
    money: { householdPercentile: 50, savings: 0, debt: 0 },
    relationships: [],
    conditions: [],
    flags: {},
    ...overrides,
  };
}
