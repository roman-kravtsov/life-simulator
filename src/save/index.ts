// What the game store needs to keep and find lives, behind one interface so tests and the store never touch the browser.
import { createArchive, type Archive, type PastLife, type PastLifeListing } from "./archive";
import { clearCurrent, clearLocalStorage, loadCurrent, saveCurrent, type CurrentLife } from "./current";
import type { SaveFile } from "../engine/save";

export type { Archive, PastLife, PastLifeListing, CurrentLife };

export interface Persistence {
  loadCurrent(): CurrentLife;
  /** False when the browser would not keep it. */
  saveCurrent(save: SaveFile): boolean;
  clearCurrent(): void;
  archive: Archive;
  /** Removes every life and every preference the game has stored in this browser (SAVE-007). Rejects if any remains. */
  deleteAll(): Promise<void>;
}

export function browserPersistence(): Persistence {
  const archive = createArchive();
  return {
    loadCurrent: () => loadCurrent(),
    saveCurrent: (save) => saveCurrent(save),
    clearCurrent: () => clearCurrent(),
    archive,
    async deleteAll() {
      const cleared = clearLocalStorage();
      await archive.clear();
      if (!cleared) throw new Error("Some local data could not be removed");
    },
  };
}

/** Keeps nothing: for tests, and for a browser that has no storage at all. */
export function noPersistence(): Persistence {
  const none: Archive = {
    put: () => Promise.resolve(),
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(undefined),
    remove: () => Promise.resolve(),
    clear: () => Promise.resolve(),
  };
  return {
    loadCurrent: () => ({ status: "none" }),
    saveCurrent: () => true,
    clearCurrent: () => undefined,
    archive: none,
    deleteAll: () => Promise.resolve(),
  };
}
