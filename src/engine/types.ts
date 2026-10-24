// Core engine types (design 2.2). Systems such as education, work and romance extend these
// as their milestones land.
import type { Turn } from "./decisions";
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
  /** A parent or partner who is unwell and needs looking after (FAM-005). */
  ill?: boolean;
}

/** The five yearly focus areas (DEC-003). */
export type FocusArea = "learn" | "earn" | "health" | "belonging" | "rest";

/** Focus points by area. */
export type Plan = Record<FocusArea, number>;

/** An event set to happen when the person reaches `age` (EVENT-004). */
export interface ScheduledEvent {
  id: string;
  age: number;
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
  /** A fixed 0 to 1 dealt at birth: where this person's age at first marriage falls in the country's spread (REL-004). */
  marriageDraw: number;
  /** Follow-up events set by earlier events (EVENT-004). */
  scheduled: ScheduledEvent[];
  /**
   * This year's focus, as units above or below the default plan in each area (DEC-003): the plan the
   * person lives by this year, set at the start of the turn. Missing areas count as zero.
   */
  focus?: Partial<Record<FocusArea, number>>;
}

export interface Death {
  /** Completed years at death. */
  age: number;
  cause: CauseId;
}

export type Sensitivity = "none" | "difficult" | "severe";

export type HelpTopic = "suicide" | "violence" | "abuse" | "grief" | "addiction" | "illness";

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
  /** True for small texture that does not interrupt a run of quiet years (TIME-002). */
  quiet?: boolean;
  /** What the player chose and what came of it, for an event with a decision. */
  decision?: DecisionRecord;
  effects: AppliedEffect[];
}

/** Why the player did or did not choose; recorded when a decision is answered (DEC-001). */
export interface DecisionRecord {
  choiceId: string;
  choiceTextKey: string;
  outcomeTextKey: string;
}

export interface YearRecord {
  /** Age at the end of the year, or at death when `died` is set. */
  age: number;
  stage: LifeStage;
  stageChanged: boolean;
  stats: Stats;
  /** The focus points the year was lived with, forced ones included (absent before the plan starts at six). */
  plan?: Plan;
  events: EventRecord[];
  died?: boolean;
}

/** Settings that shape a life and so belong to its save (design 2.4). */
export interface Settings {
  /** Skip severe narrative events and tell hard deaths briefly (EVENT-006). */
  softening: boolean;
  /** "quiet-years" runs through years with nothing to decide or tell (TIME-002). */
  pace: "every-year" | "quiet-years";
}

export const DEFAULT_SETTINGS: Settings = { softening: false, pace: "quiet-years" };

/** The plan the player has set, and whether they ever changed it (until then the default follows the person's situation). */
export interface StoredPlan {
  points: Plan;
  custom: boolean;
}

/** One answered decision, the player's whole input besides the plan (design 2.4). */
export interface DecisionLogEntry {
  /** The age lived in that year. */
  year: number;
  eventId: string;
  choiceId: string;
}

/** One change of settings made in the middle of a life. Softening changes which events can come, so a replay needs it. */
export interface SettingsLogEntry {
  /** The age at which the change was made; it applies from the next year on. */
  age: number;
  changes: Partial<Settings>;
}

/** A plan the player set; plans carry over until the next one, so these are all the plan input a replay needs. */
export interface PlanLogEntry {
  /** The age lived in the year the plan was set for. */
  age: number;
  plan: Plan;
}

export interface LifeState {
  seed: string;
  person: Person;
  history: YearRecord[];
  death?: Death;
  settings: Settings;
  plan?: StoredPlan;
  /** The year in progress, waiting for the player to answer a decision (DEC-001). */
  turn?: Turn;
  decisions: DecisionLogEntry[];
  /** Settings changed during the life, with the age at which each took effect; a replay applies them in order (design 2.4). */
  settingsLog?: SettingsLogEntry[];
  /** Plans the player set, in order (design 2.4). */
  planLog?: PlanLogEntry[];
}
