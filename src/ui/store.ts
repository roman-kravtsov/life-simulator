// Bridges the pure engine to React (useSyncExternalStore). The engine stays
// framework-free; React only reads snapshots and calls these actions. The store also owns the
// one piece of I/O a life needs: loading the world data, which it receives from outside.
import { advance, newLife } from "../engine/life";
import { dailyIncome, householdBand } from "../engine/money";
import { readableSeed } from "../engine/seed";
import { stream } from "../engine/rng";
import type { LifeState, Relationship } from "../engine/types";
import { drawBirthCountry } from "../engine/world/birth";
import type { Country, CountryIndex } from "../engine/world/types";

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
  backToStart(): void;
  openSources(): void;
  closeSources(): void;
}

const START: GameSnapshot = { screen: "start", life: null, country: null, sources: null, status: "idle" };

export function createGameStore(makeSeed: () => string, world: WorldLoader): GameStore {
  let snapshot: GameSnapshot = START;
  /** Bumped whenever the player leaves, so a slow load never lands on the wrong screen. */
  let attempt = 0;
  const listeners = new Set<() => void>();

  const set = (next: GameSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async begin() {
      if (snapshot.status === "loading") return;
      const mine = ++attempt;
      set({ ...START, status: "loading" });
      try {
        const seed = makeSeed();
        const index = await world.loadIndex();
        const entry = drawBirthCountry(index, stream(seed, "birth", 0));
        const country = await world.loadCountry(entry.iso3);
        if (mine !== attempt) return;
        set({
          screen: "birth",
          life: newLife({ seed, country }),
          country,
          sources: index.sources,
          status: "idle",
        });
      } catch {
        if (mine === attempt) set({ ...START, status: "error" });
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
    backToStart() {
      attempt++;
      set(START);
    },
    openSources() {
      attempt++;
      set({ ...START, screen: "sources" });
    },
    closeSources() {
      set(START);
    },
  };
}

/** Seeds for new lives come from the browser, outside the engine (RNG-003). */
export const browserSeed = () => readableSeed(() => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32);
