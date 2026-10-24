// Bridges the pure engine to React (useSyncExternalStore). The engine stays
// framework-free; React only reads snapshots and calls these actions. The store also owns the
// one piece of I/O a life needs: loading the world data, which it receives from outside.
import { SCHOOL_START_AGE } from "../engine/education";
import type { DecisionCard } from "../engine/decisions";
import { FOCUS_AREAS, PLAN_START_AGE, resolvePlan, type ForcedPoint, type LockReason } from "../engine/focus";
import { advance, decisionCard, newLife, withSettings } from "../engine/life";
import { currentPercentile, dailyIncome, householdBand, INDEPENDENCE_AGE, yearlyIncome } from "../engine/money";
import { readableSeed } from "../engine/seed";
import { stream } from "../engine/rng";
import { conditionCatalog } from "../content/healthConditions";
import {
  DEFAULT_SETTINGS,
  type EducationLevel,
  type FocusArea,
  type HealthCondition,
  type HelpTopic,
  type LifeState,
  type Plan,
  type Relationship,
  type Sector,
  type Settings,
} from "../engine/types";
import { drawBirthCountry } from "../engine/world/birth";
import type { Country, CountryIndex } from "../engine/world/types";
import { incomeBand, type IncomeBand } from "../format";

export type Screen = "start" | "birth" | "life" | "sources";

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
}

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
 * draft with any point left unplaced resting, so the plan spends exactly the points available.
 */
export function planToSend(plan: PlanOverview, draft: Plan): Plan | undefined {
  const placed = plan.areas.reduce((sum, area) => sum + draft[area], 0);
  const full = { ...draft, rest: draft.rest + Math.max(0, plan.free - placed) };
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

export interface WorldLoader {
  loadIndex(): Promise<CountryIndex>;
  loadCountry(iso3: string): Promise<Country>;
}

export interface GameStore {
  getSnapshot(): GameSnapshot;
  subscribe(listener: () => void): () => void;
  /** Draws a birth country by the real odds, loads it and shows the birth screen. */
  begin(): Promise<void>;
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
};

export function createGameStore(makeSeed: () => string, world: WorldLoader): GameStore {
  let snapshot: GameSnapshot = START;
  /** Bumped whenever the player leaves, so a slow load never lands on the wrong screen. */
  let attempt = 0;
  const listeners = new Set<() => void>();
  /** How long the history was before the last continue, to tell which years are new. */
  let yearsFrom = 0;

  const set = (next: GameSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  /** The start state, keeping the settings the player chose. */
  const fresh = (changes: Partial<GameSnapshot> = {}): GameSnapshot => ({
    ...START,
    showUsPrices: snapshot.showUsPrices,
    settings: snapshot.settings,
    ...changes,
  });
  /** The snapshot with a new life state and everything the screens derive from it. */
  const lived = (life: LifeState, country: Country, changes: Partial<GameSnapshot> = {}): GameSnapshot => ({
    ...snapshot,
    ...changes,
    life,
    card: decisionCard(life, country) ?? null,
    plan: planOverview(life),
    quietRun: quietRunOf(life, yearsFrom),
  });

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async begin() {
      if (snapshot.status === "loading") return;
      const mine = ++attempt;
      set(fresh({ status: "loading" }));
      try {
        const seed = makeSeed();
        const index = await world.loadIndex();
        const entry = drawBirthCountry(index, stream(seed, "birth", 0));
        const country = await world.loadCountry(entry.iso3);
        if (mine !== attempt) return;
        yearsFrom = 0;
        const life = newLife({ seed, country, settings: snapshot.settings });
        set(lived(life, country, { ...fresh(), screen: "birth", country, sources: index.sources }));
      } catch {
        if (mine === attempt) set(fresh({ status: "error" }));
      }
    },
    startLife() {
      if (!snapshot.life) return;
      set({ ...snapshot, screen: "life" });
    },
    continueYear(plan) {
      const { life, country } = snapshot;
      if (!life || !country || !life.person.alive || life.turn) return;
      yearsFrom = life.history.length;
      const next = advance(life, { kind: "continue", ...(plan ? { plan } : {}) }, country).state;
      set(lived(next, country, { screen: "life" }));
    },
    choose(choiceId) {
      const { life, country, card } = snapshot;
      if (!life?.turn || !country) return;
      const choice = card?.choices.find((c) => c.id === choiceId);
      if (!choice || choice.lockedReason) return;
      set(lived(advance(life, { kind: "choose", choiceId }, country).state, country));
    },
    setSettings(changes) {
      const { life, country } = snapshot;
      const settings = { ...snapshot.settings, ...changes };
      set(life && country ? lived(withSettings(life, changes), country, { settings }) : { ...snapshot, settings });
    },
    toggleUsPrices() {
      set({ ...snapshot, showUsPrices: !snapshot.showUsPrices });
    },
    backToStart() {
      attempt++;
      set(fresh());
    },
    openSources() {
      attempt++;
      set(fresh({ screen: "sources" }));
    },
    closeSources() {
      set(fresh());
    },
  };
}

/** Seeds for new lives come from the browser, outside the engine (RNG-003). */
export const browserSeed = () => readableSeed(() => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32);
