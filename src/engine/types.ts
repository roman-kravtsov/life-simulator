// Core engine types (design 2.2). Systems such as country, family, money and
// relationships extend these as their milestones land.

export type Sex = "female" | "male";

export type LifeStage = "infancy" | "childhood" | "adolescence" | "youth" | "adulthood" | "midlife" | "elder";

export type StatId = "health" | "wellbeing" | "bonds" | "skills";

export type Stats = Record<StatId, number>;

/** Why something happened, used by the summary's chance/choice/circumstance breakdown. */
export type Cause = "circumstance" | "choice" | "chance";

export interface Person {
  name: string;
  sex: Sex;
  age: number;
  stage: LifeStage;
  alive: boolean;
  stats: Stats;
  flags: Record<string, number | boolean>;
}

export interface YearRecord {
  age: number;
  stage: LifeStage;
  stageChanged: boolean;
  stats: Stats;
}

export interface LifeState {
  seed: string;
  person: Person;
  history: YearRecord[];
}
