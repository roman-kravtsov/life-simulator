// The archive of finished lives in IndexedDB (SAVE-003, SAVE-007, design 2.4). Two stores: the lists the
// past-lives screen shows, which are small, and the lives themselves, which are not.
import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SaveFile } from "../engine/save";
import type { LifeSummary } from "../engine/summary";
import type { Ring } from "../engine/rings";

export const DATABASE = "birthright";
const VERSION = 1;

/** A finished life as stored: what the summary showed, and the save that can bring the life back. */
export interface PastLife {
  /** The life's seed: one life per seed. */
  id: string;
  /** ISO time the life ended. */
  finishedAt: string;
  summary: LifeSummary;
  save: SaveFile;
}

/** What the list of past lives needs to show a life, without opening it. */
export interface PastLifeListing {
  id: string;
  finishedAt: string;
  name: string;
  country: LifeSummary["country"];
  birthYear: number;
  age: number;
  cause: string;
  epitaph?: string;
  /** The rings in brief, for a thumbnail. */
  rings: Pick<Ring, "thickness" | "theme">[];
}

export const listingOf = ({ id, finishedAt, summary }: PastLife): PastLifeListing => ({
  id,
  finishedAt,
  name: summary.name,
  country: summary.country,
  birthYear: summary.birthYear,
  age: summary.death.age,
  cause: summary.death.cause,
  ...(summary.epitaph ? { epitaph: summary.epitaph } : {}),
  rings: summary.rings.map(({ thickness, theme }) => ({ thickness, theme })),
});

interface Schema extends DBSchema {
  pastLives: { key: string; value: PastLife };
  listings: { key: string; value: PastLifeListing };
}

export interface Archive {
  /** Stores a life, or replaces the one with the same seed (when an epitaph is added, for example). */
  put(life: PastLife): Promise<void>;
  /** The lives, most recently finished first. */
  list(): Promise<PastLifeListing[]>;
  get(id: string): Promise<PastLife | undefined>;
  remove(id: string): Promise<void>;
  /** Removes every life and the database itself (SAVE-007). */
  clear(): Promise<void>;
}

export function createArchive(): Archive {
  let opened: Promise<IDBPDatabase<Schema>> | undefined;
  const db = () =>
    (opened ??= openDB<Schema>(DATABASE, VERSION, {
      upgrade(upgrading) {
        upgrading.createObjectStore("pastLives", { keyPath: "id" });
        upgrading.createObjectStore("listings", { keyPath: "id" });
      },
      // Another tab or a later call deleting the database must not wait for this connection.
      blocking() {
        const closing = opened;
        opened = undefined;
        void closing?.then((connection) => connection.close());
      },
      terminated() {
        opened = undefined;
      },
    }).catch((error) => {
      opened = undefined;
      throw error;
    }));
  return {
    async put(life) {
      const tx = (await db()).transaction(["pastLives", "listings"], "readwrite");
      await Promise.all([
        tx.objectStore("pastLives").put(life),
        tx.objectStore("listings").put(listingOf(life)),
        tx.done,
      ]);
    },
    async list() {
      const all = await (await db()).getAll("listings");
      return all.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
    },
    async get(id) {
      return (await db()).get("pastLives", id);
    },
    async remove(id) {
      const tx = (await db()).transaction(["pastLives", "listings"], "readwrite");
      await Promise.all([tx.objectStore("pastLives").delete(id), tx.objectStore("listings").delete(id), tx.done]);
    },
    async clear() {
      if (opened) (await opened.catch(() => undefined))?.close();
      opened = undefined;
      await deleteDB(DATABASE);
    },
  };
}
