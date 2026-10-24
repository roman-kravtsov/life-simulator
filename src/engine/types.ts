// Core engine types (design 2.2). Systems such as education, work and romance extend these
// as their milestones land.
import type { AppliedEffect } from "./effects";

export type Sex = "female" | "male";

export type LifeStage = "infancy" | "childhood" | "adolescence" | "youth" | "adulthood" | "midlife" | "elder";

export type StatId = "health" | "happiness" | "belonging" | "skills";

export type Stats = Record<StatId, number>;

/** Hidden traits dealt at birth, each from -2 to 2 (CHAR-003). */
export type TraitId = "temperament" | "curiosity" | "resilience" | "sociability" | "aptitude" | "constitution";

export type Traits = Record<TraitId, number>;

export const TRAIT_IDS: readonly TraitId[] = [
  "temperament",
  "curiosity",
  "resilience",
  "sociability",
  "aptitude",
  "constitution",
];

/** Why something happened, used by the summary's chance/choice/circumstance breakdown. */
export type Cause = "circumstance" | "choice" | "chance";

export type Location = "rural" | "urban";

/** A cause-of-death id from the WHO GHE mix in the country files (for example "cardiovascular"). */
export type CauseId = string;

export type RelationshipKind = "mother" | "father" | "sibling" | "partner" | "spouse" | "child" | "friend" | "mentor";

export interface Relationship {
  id: string;
  kind: RelationshipKind;
  name: string;
  sex: Sex;
  age: number;
  alive: boolean;
  /** 0 to 100. */
  closeness: number;
}

/** A lasting health problem (HEALTH-004). The definitions live in src/content/healthConditions.ts. */
export interface HealthCondition {
  id: string;
  /** 1 (mild) to 3 (severe). */
  severity: 1 | 2 | 3;
  /** The age at which it began. */
  since: number;
  /** The cause of death this condition makes more likely, if any. */
  raises?: CauseId;
}

/** The highest school level completed (EDU-001). */
export type EducationLevel = "none" | "primary" | "lower-secondary" | "upper-secondary" | "tertiary";

export interface Education {
  level: EducationLevel;
  inSchool: boolean;
  /** Years spent in school so far. */
  years: number;
  /** Set at the end of the primary years (EDU-002); absent before then. */
  literate?: boolean;
}

export type WorkStatus = "child" | "student" | "employed" | "informal" | "unemployed" | "caregiver" | "retired";

export type Sector = "agriculture" | "industry" | "services";

export interface Work {
  status: WorkStatus;
  /** The person's job, once they have had one (CAREER-002). */
  sector?: Sector;
  formal?: boolean;
  /** Years in work so far. */
  yearsWorked: number;
  /** A fixed 0 to 1 dealt at birth: the person works at ages where the country's participation exceeds it (CAREER-001). */
  attachment: number;
}

export interface Person {
  name: string;
  sex: Sex;
  /** Calendar year of birth, from the reference year of the country's life table. */
  birthYear: number;
  countryIso3: string;
  age: number;
  stage: LifeStage;
  alive: boolean;
  traits: Traits;
  stats: Stats;
  location: Location;
  education: Education;
  work: Work;
  money: {
    /** 1 to 100 within the country's distribution, drawn at birth (MONEY-001). */
    householdPercentile: number;
    /** Where the person stands now, 1 to 100: the household's until adulthood, then their own (MONEY-003). */
    percentile: number;
    /** A standard normal draw at birth: the person's lasting good or bad fortune in the income mix. */
    luck: number;
    savings: number;
    debt: number;
  };
  relationships: Relationship[];
  conditions: HealthCondition[];
  flags: Record<string, number | boolean>;
}

export interface Death {
  /** Completed years at death. */
  age: number;
  cause: CauseId;
}

export type Sensitivity = "none" | "difficult" | "severe";

export type HelpTopic = "suicide" | "violence" | "abuse" | "grief" | "addiction";

/** One thing that happened in a year, with the effects it had and why (SIM-006). */
export interface EventRecord {
  id: string;
  textKey: string;
  /** Values the text interpolates, such as a relative's name. */
  vars?: Record<string, string | number>;
  tags?: string[];
  sensitivity?: Sensitivity;
  helpTopic?: HelpTopic;
  /** The quiet "here, about N in 100..." line with its source and year. */
  dataNote?: { textKey: string; value: number; source: string; year: number };
  effects: AppliedEffect[];
}

export interface YearRecord {
  /** Age at the end of the year, or at death when `died` is set. */
  age: number;
  stage: LifeStage;
  stageChanged: boolean;
  stats: Stats;
  events: EventRecord[];
  died?: boolean;
}

export interface LifeState {
  seed: string;
  person: Person;
  history: YearRecord[];
  death?: Death;
}
