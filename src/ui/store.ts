// Bridges the pure engine to React (useSyncExternalStore). The engine stays
// framework-free; React only reads snapshots and calls these actions. The store also owns the
// one piece of I/O a life needs: loading the world data, which it receives from outside.
import { SCHOOL_START_AGE } from "../engine/education";
import type { DecisionCard } from "../engine/decisions";
import { FOCUS_AREAS, PLAN_START_AGE, resolvePlan, type ForcedPoint, type LockReason } from "../engine/focus";
import { advance, decisionCard, EPITAPH_MAX_LENGTH, newLife, withEpitaph, withSettings } from "../engine/life";
import { lifeExpectancy } from "../engine/mortality";
import { currentPercentile, dailyIncome, householdBand, INDEPENDENCE_AGE, yearlyIncome } from "../engine/money";
import { buildRings, RING_THEMES, type Ring } from "../engine/rings";
import {
  exportFileName,
  exportText,
  IMPORT_MAX_LENGTH,
  isSnapshotOf,
  parseImport,
  readSave,
  restoreLife,
  resave,
  toSave,
  MIGRATIONS,
  SCHEMA_VERSION,
  type ImportResult,
  type Migrations,
  type SaveFile,
} from "../engine/save";
import { JOURNAL_MAX_LENGTH, journalLine, reflectionPrompt, withJournalEntry } from "../engine/reflection";
import { readableSeed } from "../engine/seed";
import { stream } from "../engine/rng";
import { keyMoments, summarize, type LifeSummary } from "../engine/summary";
import { conditionCatalog } from "../content/healthConditions";
import { reflections } from "../content/reflections";
import { CONTENT_VERSION } from "../content/version";
import {
  DEFAULT_SETTINGS,
  type EducationLevel,
  type EventRecord,
  type FocusArea,
  type HealthCondition,
  type HelpTopic,
  type LifeState,
  type Plan,
  type Relationship,
  type Sector,
  type Settings,
  type Sex,
  type StatId,
  type YearRecord,
} from "../engine/types";
import { drawBirthCountry } from "../engine/world/birth";
import type { Country, CountryIndex } from "../engine/world/types";
import { incomeBand, type IncomeBand } from "../format";
import { noPersistence, type PastLife, type PastLifeListing, type Persistence } from "../save";
import { revealView, type RevealView } from "./reveal";

// Screens read these through the store, so they never import the engine for a value.
export { EPITAPH_MAX_LENGTH, IMPORT_MAX_LENGTH, JOURNAL_MAX_LENGTH, RING_THEMES };

/**
 * The string key of a reflection prompt's words, for a journal line that answered it (UI-007, SUM-005); undefined
 * when this version no longer has that prompt, so the line is shown without it.
 */
export const promptTextKey = (id: string): string | undefined => reflections.find((def) => def.id === id)?.text;

export type Screen = "start" | "reveal" | "birth" | "life" | "sources" | "summary" | "past" | "settings";

export type LoadStatus = "idle" | "loading" | "error";

export interface GameSnapshot {
  screen: Screen;
  life: LifeState | null;
  /** The country the life is lived in, loaded when the life begins. */
  country: Country | null;
  /** Source details for the data notes shown in the story. */
  sources: CountryIndex["sources"] | null;
  status: LoadStatus;
  /** Whether the money panel also says what the amounts buy in the United States (MONEY-007). A setting, kept across lives. */
  showUsPrices: boolean;
  /** Softer telling and the pace of quiet years (EVENT-006, TIME-002). Kept across lives; a new life starts with them. */
  settings: Settings;
  /** The decision the year is waiting on, with its choices and odds lens (DEC-001); null when none is. */
  card: DecisionCard | null;
  /** The yearly focus plan; null before age six, while a decision waits and once the life has ended (DEC-003). */
  plan: PlanOverview | null;
  /** The years that just passed quietly, or null when the last step was a single year (TIME-002). */
  quietRun: QuietRun | null;
  /** The prompt for the year just lived, with the player's line if they wrote one (UI-007); null when there is none to offer. */
  reflection: ReflectionView | null;
  /** The stats that moved by 3 or more over the step just taken, for the screen reader (A11Y-002). */
  statChanges: StatChange[];
  /** The finished life on the summary screen (SUM-001); null on every other screen. */
  summary: SummaryView | null;
  /** What the start screen offers about a life saved in this browser (SAVE-002); null when there is none. */
  resume: ResumeOffer | null;
  /** The archive of finished lives (SAVE-003); null until loaded. */
  pastLives: PastLifeListing[] | null;
  /** Set when the browser refused to keep the life in progress, or the archive could not be written or read. */
  problem: "current" | "archive" | null;
  /** Set when a resumed life was not what was saved: rebuilt from its seed, or saved by an older version (SAVE-005, RNG-004). */
  restored: "replayed" | "inexact" | "both" | null;
  /** Set when everything stored in this browser was just deleted, so the start screen can say so (SAVE-007). */
  deleted: boolean;
  /** The birth reveal on screen (UI-016): the country already drawn, the names that pass before it; null on every other screen. */
  reveal: RevealView | null;
  /** Set when the reveal was left out for reduced motion, so the birth screen says how the country was drawn (UI-016). */
  chanceNote: boolean;
}

/** A finished life as the summary screen shows it. */
export interface SummaryView {
  summary: LifeSummary;
  /** The events of the last recorded year, told under the closing passage. */
  lastYear: EventRecord[];
  /** True when the life was opened from the archive rather than just finished. */
  archived: boolean;
}

/** A reflection prompt as the life screen shows it: which one, in which year, and what the player has written for it. */
export interface ReflectionView {
  id: string;
  /** The string key of the prompt's words. */
  textKey: string;
  /** The age the line is written at. */
  age: number;
  written?: string;
}

/** One stat that moved over a step: the change in points, with its sign. */
export interface StatChange {
  stat: StatId;
  delta: number;
}

/** A stat counts as having moved when it changed by this many points or more. */
const STAT_CHANGE_MIN = 3;
const STAT_ORDER: readonly StatId[] = ["health", "happiness", "belonging", "skills"];

/**
 * How the stats moved from the end of the year before the step (the record at `from - 1`) to the end of the last
 * year: those that changed by 3 points or more, the largest first. Nothing for the first year, which has no year
 * before it.
 */
export function statChanges(history: readonly YearRecord[], from: number): StatChange[] {
  const before = history[from - 1];
  const last = history.at(-1);
  if (!before || !last) return [];
  return STAT_ORDER.map((stat) => ({ stat, delta: Math.round(last.stats[stat] - before.stats[stat]) }))
    .filter(({ delta }) => Math.abs(delta) >= STAT_CHANGE_MIN)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** The prompt for the year on screen: not while a decision waits, whose year is not told yet, nor once the life is over. */
function reflectionOf(life: LifeState, card: DecisionCard | null): ReflectionView | null {
  if (!life.person.alive || life.turn || card) return null;
  const found = reflectionPrompt(life.history);
  if (!found) return null;
  const age = life.person.age;
  const written = journalLine(life, age, found.id);
  return { id: found.id, textKey: found.text, age, ...(written ? { written } : {}) };
}

/** A saved life the start screen can offer to continue, or the reason it cannot. */
export type ResumeOffer =
  | {
      kind: "offer";
      seed: string;
      countryIso3: string;
      /** Where the life is lived, once the world's index has been read (it is not in the save). */
      country?: { iso2: string; name: string };
      name?: string;
      age?: number;
    }
  | { kind: "problem"; reason: "unsupported" | "damaged" | "unreadable" };

/** The focus plan as the plan widget needs it (UI-005), derived here so screens stay free of engine code. */
export interface PlanOverview {
  /** The five areas, in the order they are shown. */
  areas: readonly FocusArea[];
  /** Points the player places themselves: the budget less what circumstance has taken. */
  free: number;
  /** The player's own points as the plan stands. */
  chosen: Plan;
  /** Points circumstance took first, each with its reason. */
  forced: ForcedPoint[];
  /** Areas that take no points, with the reason. */
  locked: Partial<Record<FocusArea, LockReason>>;
  /** True once the player has set the plan; until then it follows the situation. */
  custom: boolean;
}

/** The years that passed in one step without anything to tell, as the ages reached (TIME-002). */
export interface QuietRun {
  from: number;
  to: number;
}

/** Null when no plan is asked for: before six, with a decision waiting, or after death. */
export function planOverview(life: LifeState): PlanOverview | null {
  const { person } = life;
  if (!person.alive || life.turn || person.age < PLAN_START_AGE) return null;
  const { chosen, forced, locked, free } = resolvePlan(person, life.plan);
  return { areas: FOCUS_AREAS, free, chosen, forced, locked, custom: life.plan?.custom === true };
}

/**
 * The plan to send with Continue: nothing while the draft is what the plan already is, otherwise the
 * draft with any point left unplaced resting, so the plan spends exactly the points available. A value
 * that is not a whole number (an emptied field) counts as 0, and no more than the free points are kept.
 */
export function planToSend(plan: PlanOverview, draft: Plan): Plan | undefined {
  const full = { ...draft };
  let placed = 0;
  for (const area of plan.areas) {
    const value = Number.isInteger(draft[area]) ? Math.max(0, draft[area]) : 0;
    full[area] = Math.min(value, Math.max(0, plan.free - placed));
    placed += full[area];
  }
  full.rest += Math.max(0, plan.free - placed);
  return plan.areas.some((area) => full[area] !== plan.chosen[area]) ? full : undefined;
}

/** What the years of the last step were like, for the line about years that pass quietly. */
function quietRunOf(life: LifeState, from: number): QuietRun | null {
  const records = life.history.slice(from);
  // With a decision waiting, every new year was quiet; otherwise the last one is told in full.
  const quiet = life.turn ? records : records.slice(0, -1);
  const first = quiet[0];
  const last = quiet.at(-1);
  return first && last ? { from: first.age, to: last.age } : null;
}

/** What the birth screen says about the household and parents, derived here so screens stay free of engine code. */
export interface BirthSummary {
  /** Older brothers and sisters at the birth. */
  siblings: number;
  band: number;
  /** Daily income per person in PPP dollars at the household's percentile. */
  income: number;
  incomeYear: number;
  mother: Relationship;
  father: Relationship;
}

export function birthSummary(life: LifeState, country: Country): BirthSummary {
  const { relationships, money } = life.person;
  const parent = (kind: Relationship["kind"]) => {
    const found = relationships.find((r) => r.kind === kind);
    if (!found) throw new Error(`A new life always has a ${kind}`);
    return found;
  };
  return {
    siblings: relationships.filter((r) => r.kind === "sibling").length,
    band: householdBand(money.householdPercentile),
    income: dailyIncome(country, money.householdPercentile),
    incomeYear: country.money.percentiles.year,
    mother: parent("mother"),
    father: parent("father"),
  };
}

type SchoolLevelId = Exclude<EducationLevel, "none">;

const LEVELS_IN_ORDER: readonly EducationLevel[] = [
  "none",
  "primary",
  "lower-secondary",
  "upper-secondary",
  "tertiary",
];

/** School in words (EDU-001): the parts of the line, not the line. `level` is the one attended, finished or left. */
export type EducationSummary =
  | { kind: "too-young" }
  | { kind: "never" }
  | { kind: "attending" | "completed" | "left-early"; level: SchoolLevelId; years: number };

/** Work in words (CAREER-001, CAREER-002, CAREER-006). */
export type WorkSummary =
  | { kind: "too-young" | "at-home" | "student" | "unemployed" | "caregiver"; yearsWorked: number }
  | { kind: "retired"; yearsWorked: number }
  | { kind: "working"; sector: Sector | null; formal: boolean; yearsWorked: number };

export interface MoneySummary {
  /** Daily income per person in PPP dollars: the person's own as an independent adult, otherwise the household's. */
  daily: number;
  /** The same income over a year, with retirement already taken into account. */
  yearly: number;
  band: IncomeBand;
  /** True when the income is the person's own, false while it is the household's. */
  own: boolean;
  /** Reference year of the income distribution. */
  year: number;
  /** Savings and debt in PPP dollars; null for children and students, who have none of their own. */
  holdings: { savings: number; debt: number } | null;
}

export type ClosenessBand = "very-close" | "close" | "friendly" | "distant" | "strained";

/** Closeness (0 to 100) in words: 80 and up very close, 60 close, 40 friendly, 20 distant, below 20 strained. */
export function closenessBand(closeness: number): ClosenessBand {
  if (closeness >= 80) return "very-close";
  if (closeness >= 60) return "close";
  if (closeness >= 40) return "friendly";
  if (closeness >= 20) return "distant";
  return "strained";
}

export interface FamilySummary {
  parents: Relationship[];
  /** Oldest first. */
  siblings: Relationship[];
  /** Partner, spouse, children, friends and mentors, in the order they came into the life. */
  others: Relationship[];
}

/** What the life screen's panels show, derived here so screens stay free of engine code. */
export interface LifeOverview {
  education: EducationSummary;
  /** From age 15, whether the person can read; null before then or when not yet known (EDU-002). */
  literacy: "literate" | "illiterate" | null;
  /** Null under age 6: there is nothing to say about work yet. */
  work: WorkSummary | null;
  money: MoneySummary;
  /** `helpTopic` is the condition's own, so its help stays on screen for as long as it lasts. */
  conditions: (Pick<HealthCondition, "id" | "severity" | "since"> & { helpTopic?: HelpTopic })[];
  family: FamilySummary;
}

/** The literacy line is shown from this age. */
const LITERACY_SHOWN_AGE = 15;
/** Work is mentioned from this age. */
const WORK_SHOWN_AGE = 6;
/** The first age at which a teenager is no longer counted as a child with no work to speak of. */
const WORKING_AGE = 15;
const DAYS_IN_YEAR = 365;

function educationSummary({ age, education }: LifeState["person"]): EducationSummary {
  const { level, inSchool, years } = education;
  const next = LEVELS_IN_ORDER[LEVELS_IN_ORDER.indexOf(level) + 1];
  if (inSchool && next && next !== "none") return { kind: "attending", level: next, years };
  if (level !== "none") return { kind: "completed", level, years };
  if (years > 0) return { kind: "left-early", level: "primary", years };
  return age <= SCHOOL_START_AGE ? { kind: "too-young" } : { kind: "never" };
}

function workSummary({ age, work }: LifeState["person"]): WorkSummary | null {
  if (age < WORK_SHOWN_AGE) return null;
  const { status, yearsWorked } = work;
  switch (status) {
    case "child":
      return { kind: age < WORKING_AGE ? "too-young" : "at-home", yearsWorked };
    case "employed":
    case "informal":
      return {
        kind: "working",
        sector: work.sector ?? null,
        formal: work.formal ?? status === "employed",
        yearsWorked,
      };
    default:
      return { kind: status, yearsWorked };
  }
}

function moneySummary(person: LifeState["person"], country: Country): MoneySummary {
  // Same test as the engine's currentPercentile: independent and out of school.
  const own = person.age >= INDEPENDENCE_AGE && !person.education.inSchool;
  // The percentile switches to the person's own inside the turn they turn independent, so ask the engine.
  const standing = { ...person, money: { ...person.money, percentile: currentPercentile(person, country) } };
  const yearly = yearlyIncome(standing, country);
  const daily = yearly / DAYS_IN_YEAR;
  const { savings, debt } = person.money;
  return {
    daily,
    yearly,
    band: incomeBand(daily),
    own,
    year: country.money.percentiles.year,
    holdings: own && person.work.status !== "student" ? { savings, debt } : null,
  };
}

function familySummary(relationships: readonly Relationship[]): FamilySummary {
  const isParent = (r: Relationship) => r.kind === "mother" || r.kind === "father";
  return {
    parents: relationships.filter(isParent).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "mother" ? -1 : 1)),
    siblings: relationships.filter((r) => r.kind === "sibling").sort((a, b) => b.age - a.age),
    others: relationships.filter((r) => !isParent(r) && r.kind !== "sibling"),
  };
}

export function lifeOverview(life: LifeState, country: Country): LifeOverview {
  const { person } = life;
  const { literate } = person.education;
  return {
    education: educationSummary(person),
    literacy:
      person.age >= LITERACY_SHOWN_AGE && literate !== undefined ? (literate ? "literate" : "illiterate") : null,
    work: workSummary(person),
    money: moneySummary(person, country),
    conditions: person.conditions.map(({ id, severity, since }) => {
      const helpTopic = conditionCatalog.get(id)?.helpTopic;
      return { id, severity, since, ...(helpTopic ? { helpTopic } : {}) };
    }),
    family: familySummary(person.relationships),
  };
}

/** The strip under the header: where the person is on the line from birth to about eighty (UI-004). */
export interface LifeStrip {
  age: number;
  /** The age the line ends at: about 80, and five years past the person once they are older than 75, so the marker never runs off it or steps back. */
  end: number;
  /** The ages lived in the years of the key moments (SUM-003), which the strip marks with dots. */
  moments: number[];
}

/** The line ends at about 80, or five years past the person's age once they are older than this. */
const STRIP_LONG_AGE = 75;
const STRIP_SPARE_YEARS = 5;

export function lifeStrip(life: LifeState): LifeStrip {
  const { age } = life.person;
  return {
    age,
    end: age > STRIP_LONG_AGE ? age + STRIP_SPARE_YEARS : 80,
    moments: keyMoments(life.history).map((moment) => moment.age),
  };
}

/** One ring for each year lived so far, for the small picture of the rings on the life screen (SUM-002). */
export const lifeRings = (history: readonly YearRecord[]): Ring[] => buildRings(history, []);

export type StatBand = "very-low" | "low" | "fair" | "good" | "very-good";

/** A stat (0 to 100) in words, for the screen reader that hears the number beside it: under 20, 40, 60 and 80, then the top. */
export function statBand(value: number): StatBand {
  if (value < 20) return "very-low";
  if (value < 40) return "low";
  if (value < 60) return "fair";
  if (value < 80) return "good";
  return "very-good";
}

export interface CountryFact {
  source: string;
  year: number;
}

/**
 * A few measured facts about the person's country for the Country tab (UI-004). A value the data pipeline filled in
 * from a regional average (`estimated`) is not a fact about this country, so it is left out.
 */
export interface CountryFacts {
  /** Life expectancy at birth for the person's sex, in years. */
  lifeExpectancy?: CountryFact & { years: number };
  /** The share (0 to 1) of people of the person's sex who finish upper secondary school. */
  upperSecondary?: CountryFact & { share: number };
  /** Daily income or consumption per person in the middle household, in international dollars. */
  middleIncome?: CountryFact & { daily: number };
}

export function countryFacts(sex: Sex, country: Country): CountryFacts {
  const facts: CountryFacts = {};
  const { lifeTable } = country.demography;
  if (!lifeTable.estimated) {
    facts.lifeExpectancy = {
      years: lifeExpectancy(lifeTable.value[sex]),
      source: lifeTable.source,
      year: lifeTable.year,
    };
  }
  const school = country.education.upperSecondaryCompletion;
  if (!school.estimated) facts.upperSecondary = { share: school.value[sex], source: school.source, year: school.year };
  const { percentiles } = country.money;
  if (!percentiles.estimated) {
    facts.middleIncome = { daily: dailyIncome(country, 50), source: percentiles.source, year: percentiles.year };
  }
  return facts;
}

/** A life as a file to give the player (SAVE-006): the name to save it under and its JSON text. */
export interface ExportedLife {
  fileName: string;
  text: string;
}

/** Why a file could not be imported: the file itself, its country, the browser's storage, or the life already in progress. */
export type ImportFailure =
  Extract<ImportResult, { ok: false }>["reason"] | "country" | "storage" | "inProgress" | "finished";

/**
 * What importing a file did (SAVE-006). A finished life goes to the past lives (`added` is false when a copy at
 * least as new was already there); a life in progress becomes the life to continue. `inexact` says the file was
 * saved with other data or content than this version has, so the life may play out a little differently from here.
 * `inProgress` is a life in progress that was not replaced (`replaces` says which, when it is known): ask, then import
 * again with `replace`. `finished` is a life in progress in the file that has since been lived to its end here.
 */
export type ImportOutcome =
  | { ok: true; kind: "current"; name: string; age: number; inexact: boolean }
  | { ok: true; kind: "past"; name: string; age: number; inexact: boolean; added: boolean }
  | { ok: false; reason: ImportFailure; name?: string; replaces?: { name: string; age: number } };

export interface WorldLoader {
  loadIndex(): Promise<CountryIndex>;
  loadCountry(iso3: string): Promise<Country>;
}

export interface GameStore {
  getSnapshot(): GameSnapshot;
  subscribe(listener: () => void): () => void;
  /**
   * Draws a birth country by the real odds, shows the birth reveal while the country loads, then the birth screen
   * (once the reveal has ended). Ignored while a begin is loading or the reveal is on screen.
   */
  begin(): Promise<void>;
  /**
   * The birth reveal is over: its last animation ended, or the player skipped it, or reduced motion left it out
   * (`reduced`, which also adds the line about chance to the birth screen). Goes to the birth screen when the life
   * is ready; otherwise the reveal says it is opening and the birth screen follows when the country has loaded.
   */
  endReveal(options?: { reduced?: boolean }): void;
  /** From the birth screen into the first year. */
  startLife(): void;
  /** Lives the next year (or a run of quiet ones). `plan` sets the focus points; leave it out to keep the plan as it is. */
  continueYear(plan?: Plan): void;
  /** Answers the waiting decision; a locked or unknown choice is ignored. */
  choose(choiceId: string): void;
  /** Changes the settings now and for the next year on; new lives start with them. */
  setSettings(changes: Partial<Settings>): void;
  /** Turns the comparison with United States prices on or off (MONEY-007). */
  toggleUsPrices(): void;
  backToStart(): void;
  openSources(): void;
  closeSources(): void;
  /** The settings screen, from the start screen (UI-009). */
  openSettings(): void;
  closeSettings(): void;
  /** Writes the player's line for the year just lived, answering the prompt `prompt` or a line of their own; an empty line removes it (UI-007). */
  writeJournal(text: string, prompt?: string): void;
  /** Reads what is saved in this browser, once when the game opens (SAVE-002). Never throws. */
  init(): void;
  /** Loads the saved life and goes back into it. */
  resumeLife(): Promise<void>;
  /** Throws away the saved life, which a new life would replace anyway. */
  discardSaved(): void;
  /** The player's few words for the person on the summary screen, kept with the life (DEATH-004). */
  writeEpitaph(text: string): void;
  /** Shows the archive of finished lives (SAVE-003). */
  openPast(): Promise<void>;
  /** Opens a finished life as a summary. */
  openPastLife(id: string): Promise<void>;
  /** Deletes a finished life; resolves true only when it is gone, false when the archive would not let it go. */
  deletePastLife(id: string): Promise<boolean>;
  /** Removes every life and preference from this browser and starts over (SAVE-007). Resolves false if it failed. */
  deleteAllData(): Promise<boolean>;
  /** The life in progress as a file (SAVE-006); null when there is none, or it cannot be read. */
  exportCurrent(): ExportedLife | null;
  /** A finished life from the archive as a file (SAVE-006); null when it is not there or cannot be read. */
  exportPastLife(id: string): Promise<ExportedLife | null>;
  /**
   * Imports the text of a file made by `exportCurrent` or `exportPastLife` (SAVE-006), possibly from another browser.
   * Never throws. A life in progress is not replaced unless `replace` is set; a finished life never touches it.
   */
  importLife(text: string, options?: { replace?: boolean }): Promise<ImportOutcome>;
}

const START: GameSnapshot = {
  screen: "start",
  life: null,
  country: null,
  sources: null,
  status: "idle",
  showUsPrices: false,
  settings: DEFAULT_SETTINGS,
  card: null,
  plan: null,
  quietRun: null,
  reflection: null,
  statChanges: [],
  summary: null,
  resume: null,
  pastLives: null,
  problem: null,
  restored: null,
  deleted: false,
  reveal: null,
  chanceNote: false,
};

const lastYearOf = (life: { history?: readonly { events?: EventRecord[] }[] }): EventRecord[] =>
  life.history?.at(-1)?.events ?? [];

export function createGameStore(
  makeSeed: () => string,
  world: WorldLoader,
  persistence: Persistence = noPersistence(),
  clock: () => string = () => new Date().toISOString(),
  /** The save format this game reads: tests give their own to rehearse a schema change (TD-002). */
  format: { migrations: Migrations; current: number } = { migrations: MIGRATIONS, current: SCHEMA_VERSION },
): GameStore {
  const readStored = (raw: unknown) => readSave(raw, format.migrations, format.current);
  /** The life in an archived save, brought up to the current schema when it can be (TD-002). */
  const savedLife = (past: PastLife): LifeState => {
    const read = readStored(past.save);
    return read.ok ? read.save.snapshot : past.save.snapshot;
  };
  let snapshot: GameSnapshot = START;
  /** Bumped whenever the player leaves, so a slow load never lands on the wrong screen. */
  let attempt = 0;
  const listeners = new Set<() => void>();
  /** How long the history was before the last continue, to tell which years are new. */
  let yearsFrom = 0;
  /** The world data version of the loaded index, which every save carries. */
  let dataVersion = "";
  /** When the life in progress was first saved, so later saves keep it. */
  let createdAt: string | undefined;
  /** The countries of the loaded index, to name the place of a saved life. */
  let countries: CountryIndex["countries"] = [];
  /** The finished life on the summary screen, whether just ended or opened from the archive: one path for the epitaph. */
  let shown: PastLife | null = null;

  const set = (next: GameSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  /** The start state, keeping the settings the player chose and what storage told us. */
  const fresh = (changes: Partial<GameSnapshot> = {}): GameSnapshot => ({
    ...START,
    showUsPrices: snapshot.showUsPrices,
    settings: snapshot.settings,
    resume: snapshot.resume,
    pastLives: snapshot.pastLives,
    problem: snapshot.problem,
    ...changes,
  });
  /** A write that worked clears the problem it would have caused; one that failed sets it. */
  const wrote = (ok: boolean, problem: "current" | "archive"): GameSnapshot["problem"] =>
    ok ? (snapshot.problem === problem ? null : snapshot.problem) : problem;

  /** What storage holds for the life in progress, as an offer or the reason it cannot be one. */
  function readResume(): ResumeOffer | null {
    try {
      const found = persistence.loadCurrent();
      if (found.status === "none") return null;
      if (found.status === "unreadable") return { kind: "problem", reason: "unreadable" };
      const read = readStored(found.raw);
      if (!read.ok) return { kind: "problem", reason: read.reason };
      const { save } = read;
      const known = isSnapshotOf(save.snapshot, save);
      const place = countries.find((entry) => entry.iso3 === save.countryIso3);
      return {
        kind: "offer",
        seed: save.seed,
        countryIso3: save.countryIso3,
        ...(place ? { country: { iso2: place.iso2, name: place.name } } : {}),
        ...(known ? { name: save.snapshot.person.name, age: save.snapshot.person.age } : {}),
      };
    } catch {
      return { kind: "problem", reason: "unreadable" };
    }
  }

  /** Writes the life in progress (SAVE-001). Returns the problem state to set. */
  function autosave(life: LifeState): GameSnapshot["problem"] {
    const save = toSave(life, { dataVersion, contentVersion: CONTENT_VERSION, now: clock(), createdAt });
    createdAt = save.createdAt;
    let ok = false;
    try {
      ok = persistence.saveCurrent(save);
    } catch {
      // Storage that cannot even be reached is a save the browser refused.
    }
    return wrote(ok, "current");
  }

  /** Removes the saved life; storage that cannot be reached has nothing to remove. */
  function clearSaved() {
    try {
      persistence.clearCurrent();
    } catch {
      // Nothing saved, nothing to clear.
    }
  }

  /** Removes the saved life only when it is this one: a newer life may have been saved since. */
  function clearSavedLife(seed: string) {
    try {
      const found = persistence.loadCurrent();
      if (found.status === "found" && (found.raw as { seed?: unknown } | null)?.seed === seed) clearSaved();
    } catch {
      // Nothing readable, nothing to clear.
    }
  }

  /** The snapshot with a new life state and everything the screens derive from it. */
  const lived = (life: LifeState, country: Country, changes: Partial<GameSnapshot> = {}): GameSnapshot => {
    const card = decisionCard(life, country) ?? null;
    return {
      ...snapshot,
      ...changes,
      life,
      card,
      plan: planOverview(life),
      quietRun: quietRunOf(life, yearsFrom),
      reflection: reflectionOf(life, card),
      // While a decision waits the page tells the wait, so the last year's changes are not told.
      statChanges: card ? [] : statChanges(life.history, yearsFrom),
    };
  };

  /**
   * Keeps a finished life in the archive; the snapshot learns if that failed. `stored` runs once the archive
   * has it, which is when the life in progress may go: a failed write leaves it where it is.
   */
  function keep(past: PastLife, stored?: () => void) {
    persistence.archive.put(past).then(
      () => {
        stored?.();
        // Only the life on screen may clear the note: a late write for an earlier life says nothing of this one.
        if (snapshot.problem === "archive" && shown === past) set({ ...snapshot, problem: null });
      },
      () => set({ ...snapshot, problem: "archive" }),
    );
  }

  /** The year-by-year view of a life that has just ended: summarise it, archive it and clear the life in progress. */
  function finish(life: LifeState, country: Country, changes: Partial<GameSnapshot> = {}): GameSnapshot {
    const finishedAt = clock();
    const summary = summarize(life, country);
    const save = toSave(life, { dataVersion, contentVersion: CONTENT_VERSION, now: finishedAt, createdAt });
    shown = { id: life.seed, finishedAt, summary, save };
    createdAt = undefined;
    keep(shown, () => clearSavedLife(life.seed));
    return {
      ...lived(life, country, changes),
      screen: "summary",
      summary: { summary, lastYear: lastYearOf(life), archived: false },
    };
  }

  /** The snapshot after a resolved turn: the summary when the life ended, otherwise the life, saved. */
  function turned(life: LifeState, country: Country, changes: Partial<GameSnapshot> = {}): GameSnapshot {
    if (life.death) return finish(life, country, changes);
    return lived(life, country, { ...changes, problem: autosave(life), restored: null });
  }

  /** Replaces the archive's lives on screen, or says the archive could not be read. */
  async function refreshPast(mine: number) {
    try {
      const pastLives = await persistence.archive.list();
      if (mine === attempt) set({ ...snapshot, pastLives });
    } catch {
      if (mine === attempt) set({ ...snapshot, pastLives: [], problem: "archive" });
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async begin() {
      // One begin at a time: while the index loads, and while the reveal plays.
      if (snapshot.status === "loading" || snapshot.screen === "reveal") return;
      const mine = ++attempt;
      set(fresh({ status: "loading" }));
      try {
        const seed = makeSeed();
        const index = await world.loadIndex();
        if (mine !== attempt) return;
        const entry = drawBirthCountry(index, stream(seed, "birth", 0));
        // The country loads while the reveal plays (UI-016); the reveal only presents what is already drawn.
        const loading = world.loadCountry(entry.iso3);
        loading.catch(() => undefined);
        set(fresh({ screen: "reveal", reveal: revealView(seed, index, entry) }));
        const country = await loading;
        if (mine !== attempt) return;
        yearsFrom = 0;
        dataVersion = index.dataVersion;
        countries = index.countries;
        createdAt = undefined;
        shown = null;
        const life = newLife({ seed, country, settings: snapshot.settings });
        // The reel may have ended (or been skipped) while the country was loading; if so, this is the moment to move on.
        const over = snapshot.reveal?.opening === true;
        set(
          lived(life, country, {
            ...fresh({ resume: null }),
            screen: over ? "birth" : "reveal",
            reveal: over ? null : snapshot.reveal,
            chanceNote: snapshot.chanceNote,
            country,
            sources: index.sources,
            problem: autosave(life),
          }),
        );
      } catch {
        if (mine === attempt) set(fresh({ status: "error" }));
      }
    },
    endReveal(options) {
      if (snapshot.screen !== "reveal" || !snapshot.reveal) return;
      const chanceNote = snapshot.chanceNote || options?.reduced === true;
      // The life is ready: on to the birth screen. Otherwise say it is opening; begin() moves on when the country is in.
      if (snapshot.life) set({ ...snapshot, screen: "birth", reveal: null, chanceNote });
      else set({ ...snapshot, reveal: { ...snapshot.reveal, opening: true }, chanceNote });
    },
    startLife() {
      if (!snapshot.life) return;
      set({ ...snapshot, screen: "life", chanceNote: false, problem: autosave(snapshot.life) });
    },
    continueYear(plan) {
      const { life, country } = snapshot;
      if (!life || !country || !life.person.alive || life.turn) return;
      yearsFrom = life.history.length;
      const next = advance(life, { kind: "continue", ...(plan ? { plan } : {}) }, country).state;
      set(turned(next, country, { screen: "life" }));
    },
    choose(choiceId) {
      const { life, country, card } = snapshot;
      if (!life?.turn || !country) return;
      const choice = card?.choices.find((c) => c.id === choiceId);
      if (!choice || choice.lockedReason) return;
      set(turned(advance(life, { kind: "choose", choiceId }, country).state, country));
    },
    setSettings(changes) {
      const { life, country } = snapshot;
      const settings = { ...snapshot.settings, ...changes };
      if (!life || !country) return set({ ...snapshot, settings });
      const changed = withSettings(life, changes);
      // A life that is over is not saved again: it is in the archive.
      set(lived(changed, country, { settings, ...(life.person.alive ? { problem: autosave(changed) } : {}) }));
    },
    toggleUsPrices() {
      set({ ...snapshot, showUsPrices: !snapshot.showUsPrices });
    },
    backToStart() {
      attempt++;
      set(fresh({ resume: readResume() }));
    },
    openSources() {
      attempt++;
      set(fresh({ screen: "sources" }));
    },
    closeSources() {
      set(fresh());
    },
    openSettings() {
      attempt++;
      set(fresh({ screen: "settings" }));
    },
    closeSettings() {
      set(fresh());
    },
    writeJournal(text, prompt) {
      const { life, country } = snapshot;
      if (!life || !country || !life.person.alive) return;
      const changed = withJournalEntry(life, { age: life.person.age, ...(prompt ? { prompt } : {}), text });
      set(lived(changed, country, { problem: autosave(changed) }));
    },
    init() {
      set({ ...snapshot, resume: readResume() });
      // The place of a saved life is only in the index. It is needed to play anyway, so reading it now costs nothing.
      if (snapshot.resume?.kind !== "offer") return;
      world.loadIndex().then(
        (index) => {
          countries = index.countries;
          if (snapshot.screen === "start" && snapshot.resume?.kind === "offer")
            set({ ...snapshot, resume: readResume() });
        },
        () => undefined,
      );
    },
    async resumeLife() {
      if (snapshot.status === "loading") return;
      const mine = ++attempt;
      let save: SaveFile;
      try {
        const found = persistence.loadCurrent();
        const read = found.status === "found" ? readStored(found.raw) : undefined;
        if (!read?.ok) {
          set(fresh({ resume: readResume() }));
          return;
        }
        save = read.save;
      } catch {
        set(fresh({ resume: { kind: "problem", reason: "unreadable" } }));
        return;
      }
      set({ ...snapshot, status: "loading" });
      try {
        const index = await world.loadIndex();
        const country = await world.loadCountry(save.countryIso3);
        if (mine !== attempt) return;
        const restored = restoreLife(save, country, {
          dataVersion: index.dataVersion,
          contentVersion: CONTENT_VERSION,
        });
        if (!restored.ok) {
          set(fresh({ resume: { kind: "problem", reason: "damaged" } }));
          return;
        }
        const { life } = restored;
        yearsFrom = life.history.length;
        dataVersion = index.dataVersion;
        countries = index.countries;
        createdAt = save.createdAt;
        shown = null;
        const changes: Partial<GameSnapshot> = {
          ...fresh({ resume: null }),
          country,
          sources: index.sources,
          settings: life.settings,
          restored:
            restored.source === "replay" ? (restored.exact ? "replayed" : "both") : restored.exact ? null : "inexact",
        };
        // A life saved at its end would be in the archive; if one is here, finish it rather than play it.
        set(
          life.death
            ? finish(life, country, changes)
            : lived(life, country, { ...changes, screen: life.history.length === 0 ? "birth" : "life" }),
        );
      } catch {
        if (mine === attempt) set({ ...snapshot, status: "error" });
      }
    },
    discardSaved() {
      clearSaved();
      set({ ...snapshot, resume: null });
    },
    writeEpitaph(text) {
      if (!shown) return;
      // An archived life is read through the migrations, like any stored save, before it is written again (TD-002).
      const read = readStored(shown.save);
      if (!read.ok) return set({ ...snapshot, problem: "archive" });
      const life = withEpitaph(read.save.snapshot, text);
      const { dataVersion: savedWith, contentVersion, createdAt: first } = read.save;
      const summary: LifeSummary = { ...shown.summary };
      if (life.epitaph) summary.epitaph = life.epitaph;
      else delete summary.epitaph;
      const save = toSave(life, { dataVersion: savedWith, contentVersion, now: clock(), createdAt: first });
      shown = { ...shown, summary, save };
      keep(shown);
      set({ ...snapshot, summary: { ...snapshot.summary!, summary } });
    },
    async openPast() {
      const mine = ++attempt;
      set(fresh({ screen: "past", pastLives: null }));
      await refreshPast(mine);
    },
    async openPastLife(id) {
      const mine = ++attempt;
      try {
        // The summary's data notes name their sources, so the index comes with the life; it is not needed to read it.
        const [past, index] = await Promise.all([persistence.archive.get(id), world.loadIndex().catch(() => null)]);
        if (mine !== attempt) return;
        if (!past) {
          set({ ...snapshot, problem: "archive" });
          await refreshPast(mine);
          return;
        }
        shown = past;
        set({
          ...fresh(),
          screen: "summary",
          sources: index?.sources ?? {},
          summary: { summary: past.summary, lastYear: lastYearOf(savedLife(past)), archived: true },
        });
      } catch {
        if (mine === attempt) set({ ...snapshot, problem: "archive" });
      }
    },
    async deletePastLife(id) {
      const mine = attempt;
      try {
        await persistence.archive.remove(id);
      } catch {
        if (mine === attempt) set({ ...snapshot, problem: "archive" });
        return false;
      }
      await refreshPast(mine);
      return true;
    },
    exportCurrent() {
      try {
        const found = persistence.loadCurrent();
        const read = found.status === "found" ? readStored(found.raw) : undefined;
        return read?.ok ? { fileName: exportFileName(read.save), text: exportText(read.save) } : null;
      } catch {
        return null;
      }
    },
    async exportPastLife(id) {
      try {
        const past = await persistence.archive.get(id);
        const read = past ? readStored(past.save) : undefined;
        return read?.ok ? { fileName: exportFileName(read.save), text: exportText(read.save) } : null;
      } catch {
        return null;
      }
    },
    async importLife(text, options) {
      const mine = attempt;
      const read = parseImport(text, format.migrations, format.current);
      if (!read.ok) return { ok: false, reason: read.reason };
      const { save } = read;
      let index: CountryIndex;
      let country: Country;
      try {
        index = await world.loadIndex();
        if (!index.countries.some((entry) => entry.iso3 === save.countryIso3)) return { ok: false, reason: "country" };
        country = await world.loadCountry(save.countryIso3);
      } catch {
        return { ok: false, reason: "country" };
      }
      let life: LifeState;
      let stored: SaveFile;
      let inexact: boolean;
      let summary: LifeSummary | undefined;
      try {
        const restored = restoreLife(save, country, {
          dataVersion: index.dataVersion,
          contentVersion: CONTENT_VERSION,
        });
        if (!restored.ok) return { ok: false, reason: "damaged" };
        life = restored.life;
        inexact = !restored.exact;
        // What is kept is the life as it now is, in the current shape, never the file as it came. It must read back
        // as a save, and the screens must be able to show it: a file is not trusted to be tidy inside.
        stored = resave(life, save);
        if (!readSave(JSON.parse(JSON.stringify(stored))).ok) return { ok: false, reason: "damaged" };
        if (life.death) summary = summarize(life, country);
        else lived(life, country);
      } catch {
        return { ok: false, reason: "damaged" };
      }
      const who = { name: life.person.name, age: life.person.age, inexact };
      countries = index.countries;
      let have: PastLife | undefined;
      try {
        have = await persistence.archive.get(life.seed);
      } catch {
        // An archive that cannot be read cannot say; writing to it, below, will say.
      }
      if (summary) {
        let added = true;
        try {
          if (have && Date.parse(have.save.updatedAt) >= Date.parse(stored.updatedAt)) added = false;
          else {
            const finishedAt = have?.finishedAt ?? stored.updatedAt;
            await persistence.archive.put({ id: life.seed, finishedAt, summary, save: stored });
          }
        } catch {
          return { ok: false, reason: "storage" };
        }
        await refreshPast(mine);
        return { ok: true, kind: "past", ...who, added };
      }
      // An earlier copy of a life that has since been lived to its end would end up replacing it in the archive.
      if (have) return { ok: false, reason: "finished", name: who.name };
      let current: ResumeOffer | null = null;
      try {
        const found = persistence.loadCurrent();
        if (found.status !== "none") current = readResume() ?? { kind: "problem", reason: "unreadable" };
      } catch {
        current = { kind: "problem", reason: "unreadable" };
      }
      if (current && !options?.replace) {
        const replaces =
          current.kind === "offer" && current.name !== undefined && current.age !== undefined
            ? { name: current.name, age: current.age }
            : undefined;
        return { ok: false, reason: "inProgress", name: who.name, ...(replaces ? { replaces } : {}) };
      }
      let ok = false;
      try {
        ok = persistence.saveCurrent(stored);
      } catch {
        // Storage that cannot even be reached is a save the browser refused.
      }
      if (!ok) return { ok: false, reason: "storage" };
      set({ ...snapshot, resume: readResume(), problem: wrote(true, "current") });
      return { ok: true, kind: "current", ...who };
    },
    async deleteAllData() {
      attempt++;
      try {
        await persistence.deleteAll();
      } catch {
        set({ ...snapshot, problem: "archive" });
        return false;
      }
      shown = null;
      createdAt = undefined;
      yearsFrom = 0;
      set({ ...START, resume: null, pastLives: [], deleted: true });
      return true;
    },
  };
}

/** Seeds for new lives come from the browser, outside the engine (RNG-003). */
export const browserSeed = () => readableSeed(() => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32);
