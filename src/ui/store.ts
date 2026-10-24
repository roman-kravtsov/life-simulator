// Bridges the pure engine to React (useSyncExternalStore). The engine stays
// framework-free; React only reads snapshots and calls these actions. The store also owns the
// one piece of I/O a life needs: loading the world data, which it receives from outside.
import { SCHOOL_START_AGE } from "../engine/education";
import { advance, newLife } from "../engine/life";
import { currentPercentile, dailyIncome, householdBand, INDEPENDENCE_AGE, yearlyIncome } from "../engine/money";
import { readableSeed } from "../engine/seed";
import { stream } from "../engine/rng";
import type { EducationLevel, HealthCondition, LifeState, Relationship, Sector } from "../engine/types";
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
  conditions: Pick<HealthCondition, "id" | "severity" | "since">[];
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
    conditions: person.conditions.map(({ id, severity, since }) => ({ id, severity, since })),
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
  continueYear(): void;
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
};

export function createGameStore(makeSeed: () => string, world: WorldLoader): GameStore {
  let snapshot: GameSnapshot = START;
  /** Bumped whenever the player leaves, so a slow load never lands on the wrong screen. */
  let attempt = 0;
  const listeners = new Set<() => void>();

  const set = (next: GameSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  /** The start state, keeping the settings the player chose. */
  const fresh = (changes: Partial<GameSnapshot> = {}): GameSnapshot => ({
    ...START,
    showUsPrices: snapshot.showUsPrices,
    ...changes,
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
        set({
          ...fresh(),
          screen: "birth",
          life: newLife({ seed, country }),
          country,
          sources: index.sources,
        });
      } catch {
        if (mine === attempt) set(fresh({ status: "error" }));
      }
    },
    startLife() {
      if (!snapshot.life) return;
      set({ ...snapshot, screen: "life" });
    },
    continueYear() {
      const { life, country } = snapshot;
      if (!life || !country || !life.person.alive) return;
      set({ ...snapshot, screen: "life", life: advance(life, { kind: "continue" }, country).state });
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
