import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { advanceAuto, newLife, withEpitaph } from "../../src/engine/life";
import { toSave } from "../../src/engine/save";
import { summarize } from "../../src/engine/summary";
import { DATABASE, createArchive, listingOf, type PastLife } from "../../src/save/archive";
import { makeCountry } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa" });

function finished(seed: string, finishedAt: string, epitaph?: string): PastLife {
  let life = newLife({ seed, country, settings: { pace: "every-year" } });
  while (life.person.alive) life = advanceAuto(life, country);
  if (epitaph) life = withEpitaph(life, epitaph);
  const save = toSave(life, { dataVersion: "d1", contentVersion: "c1", now: finishedAt });
  return { id: seed, finishedAt, summary: summarize(life, country), save };
}

// Each test gets a database of its own: the archive deletes it when it clears.
beforeEach(async () => {
  await createArchive().clear();
});

describe("SAVE-003: the archive of finished lives", () => {
  it("keeps a life, and gives it back whole after the page is reloaded", async () => {
    const life = finished("keep-1", "2026-10-25T10:00:00.000Z", "Kept bees");
    await createArchive().put(life);
    // A new archive is what a reload makes: nothing is held in memory.
    const reopened = createArchive();
    expect(await reopened.get("keep-1")).toEqual(life);
    expect(await reopened.get("nobody")).toBeUndefined();
  });

  it("lists the lives, the most recently finished first, with what a list shows", async () => {
    const archive = createArchive();
    const a = finished("list-a", "2026-10-25T10:00:00.000Z");
    const b = finished("list-b", "2026-10-26T10:00:00.000Z", "Walked far");
    await archive.put(a);
    await archive.put(b);
    const listing = await createArchive().list();
    expect(listing.map((l) => l.id)).toEqual(["list-b", "list-a"]);
    expect(listing[0]).toEqual(listingOf(b));
    expect(listing[0]).toMatchObject({
      name: b.summary.name,
      country: { iso3: "AAA", iso2: "AA", name: "Testland" },
      age: b.summary.death.age,
      epitaph: "Walked far",
    });
    expect(listing[0]!.rings).toHaveLength(b.summary.rings.length);
    expect(listing[1]).not.toHaveProperty("epitaph");
  });

  it("holds one life per seed, so adding an epitaph replaces the stored life", async () => {
    const archive = createArchive();
    await archive.put(finished("same-seed", "2026-10-25T10:00:00.000Z"));
    await archive.put(finished("same-seed", "2026-10-25T10:00:00.000Z", "Kept bees"));
    expect(await archive.list()).toHaveLength(1);
    expect((await archive.get("same-seed"))!.summary.epitaph).toBe("Kept bees");
    expect((await archive.list())[0]!.epitaph).toBe("Kept bees");
  });

  it("brings a stored life back to the same summary when it is opened again", async () => {
    const life = finished("reopen", "2026-10-25T10:00:00.000Z");
    await createArchive().put(life);
    const stored = (await createArchive().get("reopen"))!;
    expect(stored.summary).toEqual(life.summary);
    expect(stored.save.snapshot).toEqual(life.save.snapshot);
  });
});

describe("SAVE-007: deleting lives", () => {
  it("removes one life and leaves the others", async () => {
    const archive = createArchive();
    await archive.put(finished("del-a", "2026-10-25T10:00:00.000Z"));
    await archive.put(finished("del-b", "2026-10-26T10:00:00.000Z"));
    await archive.remove("del-a");
    expect((await archive.list()).map((l) => l.id)).toEqual(["del-b"]);
    expect(await archive.get("del-a")).toBeUndefined();
    await archive.remove("never-there");
  });

  it("removes every life and the database itself when it is cleared", async () => {
    const archive = createArchive();
    await archive.put(finished("clear-a", "2026-10-25T10:00:00.000Z"));
    await archive.clear();
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(DATABASE);
    // And it works again afterwards.
    expect(await archive.list()).toEqual([]);
    await archive.put(finished("clear-b", "2026-10-26T10:00:00.000Z"));
    expect(await archive.list()).toHaveLength(1);
  });
});
