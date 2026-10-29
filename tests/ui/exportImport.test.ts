import { describe, expect, it } from "vitest";
import { exportText, IMPORT_MAX_LENGTH, readSave, SCHEMA_VERSION, type SaveFile } from "../../src/engine/save";
import { createGameStore } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { fakePersistence, finishedLife, playYears, type Fake } from "./fakes";

const country = makeCountry({ region: "Western Africa" });
const clock = () => "2026-10-29T10:00:00.000Z";

const storeFor = (fake: Fake, world = testWorld(country), seed = "new-seed") => {
  const store = createGameStore(() => seed, world, fake.persistence, clock);
  store.init();
  return store;
};

/** A browser that holds a life in progress after `years` years, and the store that lived it. */
async function livingAfter(years: number, seed = "export-seed") {
  const fake = fakePersistence();
  const store = storeFor(fake, testWorld(country), seed);
  store.setSettings({ pace: "every-year" });
  await store.begin();
  store.startLife();
  playYears(store, years);
  return { fake, store, life: store.getSnapshot().life! };
}

const fileOf = (exported: { text: string } | null) => {
  if (!exported) throw new Error("nothing to export");
  return exported.text;
};

describe("SAVE-006: exporting a life", () => {
  it("has nothing to export when no life is in progress", () => {
    expect(storeFor(fakePersistence()).exportCurrent()).toBeNull();
  });

  it("exports the life in progress as a file named for its seed, which reads back as the save", async () => {
    const { store, fake } = await livingAfter(6);
    const exported = store.exportCurrent();
    expect(exported?.fileName).toBe("birthright-export-seed.json");
    const read = readSave(JSON.parse(fileOf(exported)));
    expect(read.ok && read.save).toEqual(fake.saved.at(-1));
  });

  it("exports a finished life from the archive", async () => {
    const { past } = finishedLife("done-seed", country, "Kept bees");
    const store = storeFor(fakePersistence({ status: "none" }, [past]));
    const exported = await store.exportPastLife("done-seed");
    expect(exported?.fileName).toBe("birthright-done-seed.json");
    expect(JSON.parse(fileOf(exported))).toEqual(JSON.parse(exportText(past.save)));
    expect(await store.exportPastLife("no-such-life")).toBeNull();
  });

  it("says nothing was exported when the archive cannot be read", async () => {
    const fake = fakePersistence();
    fake.failArchive = true;
    expect(await storeFor(fake).exportPastLife("any")).toBeNull();
  });
});

describe("SAVE-006: importing a life in progress", () => {
  it("lets a clean browser continue the life, which plays on as the original would have", async () => {
    const { store: original, life } = await livingAfter(8);
    const text = fileOf(original.exportCurrent());

    const clean = fakePersistence();
    const store = storeFor(clean);
    expect(await store.importLife(text)).toEqual({
      ok: true,
      kind: "current",
      name: life.person.name,
      age: life.person.age,
      inexact: false,
    });
    expect(clean.saved).toHaveLength(1);
    expect(store.getSnapshot().resume).toMatchObject({ kind: "offer", seed: "export-seed", name: life.person.name });

    await store.resumeLife();
    const resumed = store.getSnapshot();
    expect(resumed.screen).toBe("life");
    expect(resumed.restored).toBeNull();
    expect(resumed.life).toEqual(life);
    // Both play the next year the same way, answering a decision with the first open choice.
    playYears(original, 1);
    playYears(store, 1);
    expect(store.getSnapshot().life).toEqual(original.getSnapshot().life);
  });

  it("does not replace a life in progress unless the player says so", async () => {
    const { store: original } = await livingAfter(5, "incoming");
    const text = fileOf(original.exportCurrent());
    const { fake, life: mine } = await livingAfter(3, "mine");

    const store = storeFor(fake);
    const savedBefore = fake.saved.length;
    expect(await store.importLife(text)).toMatchObject({ ok: false, reason: "inProgress" });
    expect(fake.saved).toHaveLength(savedBefore);

    expect(await store.importLife(text, { replace: true })).toMatchObject({ ok: true, kind: "current" });
    expect(fake.saved.at(-1)?.seed).toBe("incoming");
    expect(store.getSnapshot().resume).toMatchObject({ kind: "offer", seed: "incoming" });
    expect(mine.seed).toBe("mine");
  });

  it("keeps the versions it was saved with, and says so when they are not this game's", async () => {
    const { store: original } = await livingAfter(4);
    const file = JSON.parse(fileOf(original.exportCurrent())) as SaveFile;
    const older = JSON.stringify({ ...file, dataVersion: "older-data", contentVersion: "older-content" });

    const clean = fakePersistence();
    const store = storeFor(clean);
    expect(await store.importLife(older)).toMatchObject({ ok: true, inexact: true });
    expect(clean.saved.at(-1)).toMatchObject({ dataVersion: "older-data", contentVersion: "older-content" });
    await store.resumeLife();
    expect(store.getSnapshot().restored).toBe("inexact");
  });

  it("stores the life in the current shape, not the file as it came", async () => {
    const { store: original } = await livingAfter(4);
    const file = JSON.parse(fileOf(original.exportCurrent())) as Record<string, unknown>;
    const clean = fakePersistence();
    await storeFor(clean).importLife(JSON.stringify({ ...file, sneaked: "in", epitaph: { not: "text" } }));
    expect(clean.saved.at(-1)).not.toHaveProperty("sneaked");
    expect(clean.saved.at(-1)).not.toHaveProperty("epitaph");
    expect(clean.saved.at(-1)?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(clean.saved.at(-1)?.contentVersion).toBe(file.contentVersion);
  });
});

describe("SAVE-006: importing a finished life", () => {
  const fileOfFinished = (seed: string, finishedAt?: string) => {
    const { past, life, summary } = finishedLife(seed, country, "Kept bees", finishedAt);
    return { text: exportText(past.save), life, summary };
  };

  it("adds it to the past lives, with the summary the game makes of it", async () => {
    const { text, life, summary } = fileOfFinished("finished-1");
    const clean = fakePersistence();
    const store = storeFor(clean);
    expect(await store.importLife(text)).toEqual({
      ok: true,
      kind: "past",
      name: life.person.name,
      age: life.person.age,
      // The test archive's lives were made with the content version "c-test", which is not this game's.
      inexact: true,
      added: true,
    });
    expect(clean.puts).toHaveLength(1);
    expect(clean.puts[0]).toMatchObject({ id: "finished-1", finishedAt: "2026-10-25T10:00:00.000Z" });
    expect(clean.puts[0]!.summary).toEqual(summary);
    expect(clean.saved).toHaveLength(0);
    expect(store.getSnapshot().pastLives?.map((l) => l.id)).toEqual(["finished-1"]);
    await store.openPastLife("finished-1");
    expect(store.getSnapshot().summary?.summary.epitaph).toBe("Kept bees");
  });

  it("never touches the life in progress, and needs no question", async () => {
    const { text } = fileOfFinished("finished-2");
    const { fake } = await livingAfter(3, "mine");
    const before = fake.saved.length;
    expect(await storeFor(fake).importLife(text)).toMatchObject({ ok: true, kind: "past" });
    expect(fake.saved).toHaveLength(before);
    expect(fake.cleared).toBe(0);
  });

  it("keeps a copy that is already here when it is as new as the file, and takes the file when it is newer", async () => {
    const { past } = finishedLife("finished-3", country, "Kept bees", "2026-10-25T10:00:00.000Z");
    const fake = fakePersistence({ status: "none" }, [past]);
    const store = storeFor(fake);
    expect(await store.importLife(exportText(past.save))).toMatchObject({ ok: true, kind: "past", added: false });
    expect(fake.puts).toHaveLength(0);

    const later = fileOfFinished("finished-3", "2026-10-28T10:00:00.000Z");
    expect(await store.importLife(later.text)).toMatchObject({ ok: true, kind: "past", added: true });
    expect(fake.puts).toHaveLength(1);
  });
});

describe("SAVE-006: files that cannot be imported", () => {
  it("say why, and write nothing", async () => {
    const { store: original } = await livingAfter(3);
    const good = JSON.parse(fileOf(original.exportCurrent())) as SaveFile;
    const clean = fakePersistence();
    const store = storeFor(clean);
    const reason = async (text: string) => {
      const result = await store.importLife(text);
      return result.ok ? "ok" : result.reason;
    };
    expect(await reason("not json")).toBe("unreadable");
    expect(await reason(" ".repeat(IMPORT_MAX_LENGTH + 1))).toBe("tooBig");
    expect(await reason("[]")).toBe("damaged");
    expect(await reason(JSON.stringify({ ...good, schemaVersion: SCHEMA_VERSION + 1 }))).toBe("unsupported");
    expect(await reason(JSON.stringify({ ...good, snapshot: null, decisions: [{ year: "x" }], years: 30 }))).toBe(
      "damaged",
    );
    expect(clean.saved).toHaveLength(0);
    expect(clean.puts).toHaveLength(0);
  });

  it("include a life from a country this game has no data for", async () => {
    const { store: original } = await livingAfter(3);
    const good = JSON.parse(fileOf(original.exportCurrent())) as SaveFile;
    const clean = fakePersistence();
    const world = testWorld(country);
    const store = storeFor(clean, { ...world, loadCountry: () => Promise.reject(new Error("no such country")) });
    expect(await store.importLife(JSON.stringify(good))).toMatchObject({ ok: false, reason: "country" });
    expect(await storeFor(clean).importLife(JSON.stringify({ ...good, countryIso3: "ZZZ" }))).toMatchObject({
      ok: false,
      reason: "country",
    });
    expect(clean.saved).toHaveLength(0);
  });

  it("include a browser that will not keep the life", async () => {
    const { store: original } = await livingAfter(3);
    const good = fileOf(original.exportCurrent());
    const { text: finished } = (() => {
      const { past } = finishedLife("storage-1", country);
      return { text: exportText(past.save) };
    })();
    const refusing = fakePersistence();
    refusing.refuseCurrent = true;
    expect(await storeFor(refusing).importLife(good)).toMatchObject({ ok: false, reason: "storage" });
    const full = fakePersistence();
    full.failArchive = true;
    expect(await storeFor(full).importLife(finished)).toMatchObject({ ok: false, reason: "storage" });
  });
});

describe("SAVE-006: files that are not tidy", () => {
  it("are damaged when the times are not times, so they cannot break the past lives screen", async () => {
    const { past } = finishedLife("times-1", country);
    const file = JSON.parse(exportText(past.save)) as Record<string, unknown>;
    const fake = fakePersistence();
    const store = storeFor(fake);
    for (const bad of ["banana", "", 12]) {
      expect(await store.importLife(JSON.stringify({ ...file, updatedAt: bad }))).toMatchObject({
        ok: false,
        reason: "damaged",
      });
      expect(await store.importLife(JSON.stringify({ ...file, createdAt: bad }))).toMatchObject({
        ok: false,
        reason: "damaged",
      });
    }
    expect(fake.puts).toHaveLength(0);
  });

  it("are damaged when the logs inside the snapshot would not read back as a save", async () => {
    const { store: original } = await livingAfter(4);
    const file = JSON.parse(fileOf(original.exportCurrent())) as { snapshot: Record<string, unknown> };
    const clean = fakePersistence();
    const odd = { ...file, snapshot: { ...file.snapshot, settingsLog: { not: "a list" } } };
    expect(await storeFor(clean).importLife(JSON.stringify(odd))).toMatchObject({ ok: false, reason: "damaged" });
    expect(clean.saved).toHaveLength(0);
  });

  it("compare when a life was saved as times, not as text, and keep the date the life ended", async () => {
    const { past } = finishedLife("times-2", country, "Kept bees", "2026-10-25T10:00:00.000Z");
    const fake = fakePersistence({ status: "none" }, [past]);
    const store = storeFor(fake);
    const newer = { ...JSON.parse(exportText(past.save)), updatedAt: "2026-10-28T09:00:00+02:00" };
    expect(await store.importLife(JSON.stringify(newer))).toMatchObject({ ok: true, added: true });
    expect(fake.puts[0]).toMatchObject({ finishedAt: past.finishedAt });
    expect(fake.puts[0]!.save.updatedAt).toBe("2026-10-28T09:00:00+02:00");
    const older = { ...newer, updatedAt: "2026-10-28T08:00:00+02:00" };
    expect(await store.importLife(JSON.stringify(older))).toMatchObject({ ok: true, added: false });
  });
});

describe("SAVE-006: the life in progress and the archive", () => {
  it("names the life that would be replaced", async () => {
    const { store: original } = await livingAfter(5, "incoming");
    const text = fileOf(original.exportCurrent());
    const { fake, life: mine } = await livingAfter(3, "mine");
    expect(await storeFor(fake).importLife(text)).toMatchObject({
      ok: false,
      reason: "inProgress",
      replaces: { name: mine.person.name, age: mine.person.age },
    });
  });

  it("will not bring back an earlier copy of a life that has since been lived to its end", async () => {
    const { store: original } = await livingAfter(3, "ended");
    const text = fileOf(original.exportCurrent());
    const { past } = finishedLife("ended", country, "Kept bees");
    const fake = fakePersistence({ status: "none" }, [past]);
    expect(await storeFor(fake).importLife(text)).toMatchObject({ ok: false, reason: "finished" });
    expect(fake.saved).toHaveLength(0);
    expect(fake.puts).toHaveLength(0);
  });
});

describe("TD-002: lives stored before a schema change", () => {
  // An invented version 2 in which a person's money has assets, as Phase D will; the store is given that format.
  type Raw = Record<string, unknown>;
  const addAssets = (save: Raw): Raw => {
    const snapshot = save.snapshot as Raw;
    const person = snapshot.person as Raw;
    return {
      ...save,
      snapshot: { ...snapshot, person: { ...person, money: { ...(person.money as Raw), assets: [] } } },
    };
  };
  const format = { migrations: { 1: addAssets }, current: SCHEMA_VERSION + 1 };
  const withFormat = (fake: Fake) => {
    const store = createGameStore(() => "s", testWorld(country), fake.persistence, clock, format);
    store.init();
    return store;
  };
  const moneyOf = (save: SaveFile) => (save.snapshot.person.money as unknown as Raw).assets;

  it("go through the migrations when opened with an epitaph, so an old-shape snapshot is never written as a new one", async () => {
    const { past } = finishedLife("old-seed", country);
    const fake = fakePersistence({ status: "none" }, [past]);
    const store = withFormat(fake);
    await store.openPastLife("old-seed");
    store.writeEpitaph("Kept bees");
    await Promise.resolve();
    const stored = fake.lives.get("old-seed")!.save;
    expect(stored).toMatchObject({ epitaph: "Kept bees", contentVersion: past.save.contentVersion });
    expect(moneyOf(stored)).toEqual([]);
  });

  it("go through the migrations when exported", async () => {
    const { past } = finishedLife("old-seed-2", country);
    const store = withFormat(fakePersistence({ status: "none" }, [past]));
    const exported = await store.exportPastLife("old-seed-2");
    expect(moneyOf(JSON.parse(fileOf(exported)) as SaveFile)).toEqual([]);
  });

  it("tell the player when a life cannot be written again, instead of losing the epitaph quietly", async () => {
    const { past } = finishedLife("future-seed", country);
    const newer = { ...past, save: { ...past.save, schemaVersion: SCHEMA_VERSION + 1 } };
    const fake = fakePersistence({ status: "none" }, [newer]);
    const store = storeFor(fake);
    await store.openPastLife("future-seed");
    expect(store.getSnapshot().screen).toBe("summary");
    store.writeEpitaph("Kept bees");
    expect(store.getSnapshot().problem).toBe("archive");
    expect(fake.puts).toHaveLength(0);
  });
});
