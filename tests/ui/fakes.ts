// Shared by the store and screen tests of M6. Everything here is SYNTHETIC.
import { advanceAuto, newLife, withEpitaph } from "../../src/engine/life";
import { toSave, type SaveFile } from "../../src/engine/save";
import { summarize, type LifeSummary } from "../../src/engine/summary";
import type { LifeState } from "../../src/engine/types";
import type { Country } from "../../src/engine/world/types";
import type { Archive, CurrentLife, PastLife, Persistence } from "../../src/save";
import { listingOf } from "../../src/save/archive";
import type { GameStore } from "../../src/ui/store";
import { makeCountry } from "../fixtures/country";

/** A country in which everyone dies in the first year, so a life ends on the first Continue. */
export function deadlyCountry(): Country {
  const country = makeCountry({ region: "Western Africa" });
  const everyone = () => new Array<number>(101).fill(1);
  return {
    ...country,
    demography: {
      ...country.demography,
      lifeTable: { ...country.demography.lifeTable, value: { female: everyone(), male: everyone() } },
    },
  };
}

export interface Fake {
  persistence: Persistence;
  /** What the browser holds right now. */
  current: CurrentLife;
  /** The saves written for the life in progress, in order. */
  saved: SaveFile[];
  /** Number of times the life in progress was cleared. */
  cleared: number;
  /** The archive's lives by id. */
  lives: Map<string, PastLife>;
  puts: PastLife[];
  deleted: boolean;
  /** Make the next writes fail the way a full or blocked browser does. */
  refuseCurrent: boolean;
  failArchive: boolean;
}

/** An in-memory persistence that records what the store saves, archives and clears. */
export function fakePersistence(initial: CurrentLife = { status: "none" }, lives: PastLife[] = []): Fake {
  const fake: Fake = {
    current: initial,
    saved: [],
    cleared: 0,
    lives: new Map(lives.map((life) => [life.id, life])),
    puts: [],
    deleted: false,
    refuseCurrent: false,
    failArchive: false,
    persistence: undefined as unknown as Persistence,
  };
  const failure = () => Promise.reject(new Error("The archive is not available"));
  const archive: Archive = {
    put: (life) => {
      if (fake.failArchive) return failure();
      fake.puts.push(life);
      fake.lives.set(life.id, life);
      return Promise.resolve();
    },
    list: () =>
      fake.failArchive
        ? failure()
        : Promise.resolve(
            [...fake.lives.values()].map(listingOf).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)),
          ),
    get: (id) => (fake.failArchive ? failure() : Promise.resolve(fake.lives.get(id))),
    remove: (id) => {
      fake.lives.delete(id);
      return Promise.resolve();
    },
    clear: () => {
      fake.lives.clear();
      return Promise.resolve();
    },
  };
  fake.persistence = {
    loadCurrent: () => fake.current,
    saveCurrent: (save) => {
      if (fake.refuseCurrent) return false;
      fake.saved.push(save);
      // What a real browser keeps is JSON, so what comes back is a copy.
      fake.current = { status: "found", raw: JSON.parse(JSON.stringify(save)) as unknown };
      return true;
    },
    clearCurrent: () => {
      fake.cleared++;
      fake.current = { status: "none" };
    },
    archive,
    deleteAll: () => {
      fake.deleted = true;
      fake.current = { status: "none" };
      fake.lives.clear();
      return Promise.resolve();
    },
  };
  return fake;
}

export const VERSIONS = { dataVersion: "test", contentVersion: "c-test" };

/** A life lived to its end by the auto-player, with its summary and the archive record for it. */
export function finishedLife(
  seed: string,
  country: Country,
  epitaph?: string,
  finishedAt = "2026-10-25T10:00:00.000Z",
) {
  let life: LifeState = newLife({ seed, country, settings: { pace: "every-year" } });
  while (life.person.alive) life = advanceAuto(life, country);
  if (epitaph) life = withEpitaph(life, epitaph);
  const summary = summarize(life, country);
  const save = toSave(life, { ...VERSIONS, now: finishedAt });
  const past: PastLife = { id: seed, finishedAt, summary, save };
  return { life, summary, past };
}

/** The summary of a finished life with the parts a test wants to control replaced. */
export function summaryWith(summary: LifeSummary, changes: Partial<LifeSummary>): LifeSummary {
  return { ...summary, ...changes };
}

/** Plays a store's life on by `years` steps, answering any decision with the first choice that is open. */
export function playYears(store: GameStore, years: number) {
  for (let i = 0; i < years && store.getSnapshot().life?.person.alive; i++) {
    const { card } = store.getSnapshot();
    if (card) store.choose(card.choices.find((c) => !c.lockedReason)!.id);
    else store.continueYear();
  }
}
