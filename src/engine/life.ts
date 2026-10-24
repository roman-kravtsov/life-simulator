import { stageForAge } from "./stages";
import type { LifeState, Sex } from "./types";

// The engine's public API (SIM-001): pure functions, no DOM.
// The full yearly turn order (design 3.2) is built out in M3.

export interface NewLifeOptions {
  seed: string;
  sex: Sex;
  name: string;
}

export type TurnInput = { kind: "continue" };

export interface TurnResult {
  state: LifeState;
}

export function newLife({ seed, sex, name }: NewLifeOptions): LifeState {
  return {
    seed,
    person: {
      name,
      sex,
      age: 0,
      stage: stageForAge(0),
      alive: true,
      stats: { health: 70, wellbeing: 60, bonds: 60, skills: 0 },
      flags: {},
    },
    history: [],
  };
}

export function advance(state: LifeState, input: TurnInput): TurnResult {
  if (!state.person.alive) throw new Error("This life has ended");
  if (input.kind !== "continue") throw new Error(`Unknown input: ${String(input.kind)}`);

  const next = structuredClone(state);
  const person = next.person;
  const previousStage = person.stage;
  person.age += 1;
  person.stage = stageForAge(person.age);
  next.history.push({
    age: person.age,
    stage: person.stage,
    stageChanged: person.stage !== previousStage,
    stats: { ...person.stats },
  });
  return { state: next };
}
