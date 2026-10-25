// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { advanceAuto, newLife } from "../../src/engine/life";
import { readSave, toSave } from "../../src/engine/save";
import { DATABASE } from "../../src/save/archive";
import { CURRENT_KEY, clearCurrent, clearLocalStorage, loadCurrent, saveCurrent } from "../../src/save/current";
import { browserPersistence, noPersistence } from "../../src/save";
import { makeCountry } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa" });
const save = () => {
  let life = newLife({ seed: "current-1", country, settings: { pace: "every-year" } });
  life = advanceAuto(life, country);
  return toSave(life, { dataVersion: "d1", contentVersion: "c1", now: "2026-10-25T10:00:00.000Z" });
};

beforeEach(() => localStorage.clear());

describe("SAVE-001: the life in progress in localStorage", () => {
  it("says there is nothing when nothing is stored", () => {
    expect(loadCurrent()).toEqual({ status: "none" });
  });

  it("keeps a save, and reads it back as the same save", () => {
    const stored = save();
    expect(saveCurrent(stored)).toBe(true);
    const found = loadCurrent();
    expect(found.status).toBe("found");
    expect(readSave(found.status === "found" ? found.raw : undefined)).toEqual({ ok: true, save: stored });
  });

  it("replaces the save each time, under one key", () => {
    saveCurrent({ a: 1 });
    saveCurrent({ b: 2 });
    expect(localStorage.length).toBe(1);
    expect(JSON.parse(localStorage.getItem(CURRENT_KEY)!)).toEqual({ b: 2 });
  });

  it("clears it", () => {
    saveCurrent(save());
    clearCurrent();
    expect(loadCurrent()).toEqual({ status: "none" });
  });

  it("says unreadable when what is stored is not JSON", () => {
    localStorage.setItem(CURRENT_KEY, "{not json");
    expect(loadCurrent()).toEqual({ status: "unreadable" });
  });

  it("does not throw when the browser refuses, and says so", () => {
    const refusing = {
      setItem() {
        throw new DOMException("full", "QuotaExceededError");
      },
      getItem() {
        throw new DOMException("blocked", "SecurityError");
      },
      removeItem() {
        throw new DOMException("blocked", "SecurityError");
      },
    } as unknown as Storage;
    expect(saveCurrent(save(), refusing)).toBe(false);
    expect(loadCurrent(refusing)).toEqual({ status: "unreadable" });
    expect(() => clearCurrent(refusing)).not.toThrow();
  });
});

describe("SAVE-007: delete all local data", () => {
  it("leaves nothing in localStorage or IndexedDB", async () => {
    const persistence = browserPersistence();
    persistence.saveCurrent(save());
    localStorage.setItem("birthright:theme", "dark");
    localStorage.setItem("other-site:keep", "yes");
    await persistence.archive.list();
    expect((await indexedDB.databases()).map((d) => d.name)).toContain(DATABASE);

    await persistence.deleteAll();

    expect(persistence.loadCurrent()).toEqual({ status: "none" });
    expect(localStorage.getItem("birthright:theme")).toBeNull();
    expect(localStorage.getItem("other-site:keep")).toBe("yes");
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(DATABASE);
    expect(Object.keys(localStorage).filter((key) => key.startsWith("birthright"))).toEqual([]);
  });

  it("says so, and still clears the other keys and the archive, when the browser refuses to remove one", async () => {
    const persistence = browserPersistence();
    persistence.saveCurrent(save());
    localStorage.setItem("birthright:theme", "dark");
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      if (key === "birthright:theme") throw new DOMException("blocked", "SecurityError");
      remove.call(this, key);
    };
    try {
      expect(clearLocalStorage()).toBe(false);
      await expect(persistence.deleteAll()).rejects.toThrow();
      expect(persistence.loadCurrent()).toEqual({ status: "none" });
      expect(localStorage.getItem("birthright:theme")).toBe("dark");
      expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(DATABASE);
    } finally {
      Storage.prototype.removeItem = remove;
    }
  });

  it("has nothing to remove when storage is not there", () => {
    const missing = {
      get length(): number {
        throw new DOMException("blocked", "SecurityError");
      },
    } as unknown as Storage;
    expect(clearLocalStorage(missing)).toBe(true);
  });

  it("keeps nothing at all without persistence", async () => {
    const none = noPersistence();
    expect(none.saveCurrent(save())).toBe(true);
    expect(none.loadCurrent()).toEqual({ status: "none" });
    expect(await none.archive.list()).toEqual([]);
    await none.deleteAll();
  });
});
