// Bridges the pure engine to React (useSyncExternalStore). The engine stays
// framework-free; React only reads snapshots and calls these actions. The store also owns the
// one piece of I/O a life needs: loading the world data, which it receives from outside.
import { SCHOOL_START_AGE } from "../engine/education";
import type { DecisionCard } from "../engine/decisions";
import { FOCUS_AREAS, PLAN_START_AGE, resolvePlan, type ForcedPoint, type LockReason } from "../engine/focus";
import { advance, decisionCard, EPITAPH_MAX_LENGTH, newLife, withEpitaph, withSettings } from "../engine/life";
import { currentPercentile, dailyIncome, householdBand, INDEPENDENCE_AGE, yearlyIncome } from "../engine/money";
import { RING_THEMES } from "../engine/rings";
import { isSnapshotOf, readSave, restoreLife, toSave, type SaveFile } from "../engine/save";
import { readableSeed } from "../engine/seed";
import { stream } from "../engine/rng";
import { summarize, type LifeSummary } from "../engine/summary";
import { conditionCatalog } from "../content/healthConditions";
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
} from "../engine/types";
import { drawBirthCountry } from "../engine/world/birth";
import type { Country, CountryIndex } from "../engine/world/types";
import { incomeBand, type IncomeBand } from "../format";
import { noPersistence, type PastLife, type PastLifeListing, type Persistence } from "../save";

// Screens read these through the store, so they never import the engine for a value.
export { EPITAPH_MAX_LENGTH, RING_THEMES };

export type Screen = "start" | "birth" | "life" | "sources" | "summary" | "past";

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
}

/** A finished life as the summary screen shows it. */
export interface SummaryView {
  summary: LifeSummary;
  /** The events of the last recorded year, told under the closing passage. */
  lastYear: EventRecord[];
  /** True when the life was opened from the archive rather than just finished. */
  archived: boolean;
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
  summary: null,
  resume: null,
  pastLives: null,
  problem: null,
  restored: null,
  deleted: false,
};

const lastYearOf = (life: { history?: readonly { events?: EventRecord[] }[] }): EventRecord[] =>
  life.history?.at(-1)?.events ?? [];

export function createGameStore(
  makeSeed: () => string,
  world: WorldLoader,
  persistence: Persistence = noPersistence(),
  clock: () => string = () => new Date().toISOString(),
): GameStore {
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
      const read = readSave(found.raw);
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
  const lived = (life: LifeState, country: Country, changes: Partial<GameSnapshot> = {}): GameSnapshot => ({
    ...snapshot,
    ...changes,
    life,
    card: decisionCard(life, country) ?? null,
    plan: planOverview(life),
    quietRun: quietRunOf(life, yearsFrom),
  });

  /**
   * Keeps a finished life in the archive; the snapshot learns if that failed. `stored` runs once the archive
   * has it, which is when the life in progress may go: a failed write leaves it where it is.
   */
  function keep(past: PastLife, stored?: () => void) {
    persistence.archive.put(past).then(
      () => {
        stored?.();
        if (snapshot.problem === "archive") set({ ...snapshot, problem: null });
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
        dataVersion = index.dataVersion;
        countries = index.countries;
        createdAt = undefined;
        shown = null;
        const life = newLife({ seed, country, settings: snapshot.settings });
        set(
          lived(life, country, {
            ...fresh({ resume: null }),
            screen: "birth",
            country,
            sources: index.sources,
            problem: autosave(life),
          }),
        );
      } catch {
        if (mine === attempt) set(fresh({ status: "error" }));
      }
    },
    startLife() {
      if (!snapshot.life) return;
      set({ ...snapshot, screen: "life", problem: autosave(snapshot.life) });
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
        const read = found.status === "found" ? readSave(found.raw) : undefined;
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
      const life = withEpitaph(shown.save.snapshot, text);
      const { dataVersion: savedWith, contentVersion, createdAt: first } = shown.save;
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
          summary: { summary: past.summary, lastYear: lastYearOf(past.save.snapshot), archived: true },
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
