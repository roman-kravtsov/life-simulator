// TD-002: the first real schema change has not happened yet (`MIGRATIONS` is empty, version 1 is the first), so this
// file rehearses one. The two fixtures in tests/fixtures/saves are schema 1 saves exactly as the game wrote them on
// 2026-10-29, one life in progress and one finished, and must keep loading whatever the schema becomes. The rehearsal
// is an invented version 2 that gives a person a list of assets, as Phase D's money rework will; it is never shipped.
//
// What the rehearsal found, for whoever writes the first real migration (design 2.4, "Changing the schema"):
//  - A snapshot of the old shape still passes `isSnapshotOf`, and a sound snapshot is trusted over a replay, so a
//    migration must upgrade the snapshot (or drop it); the shape pin in save.test.ts is what makes you notice.
//  - Dropping the snapshot makes the game replay the life from its seed and logs. That gives the same life only if the
//    engine's rolls did not change; a change like the money rework does change them, so upgrade the snapshot in place.
//  - A replay of a fixture is not tested here on purpose: it needs the content of the day it was written, and the
//    fixture would fail on every content change. Replays are tested on lives made by the code under test (saveFile.test.ts).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advance, advanceAuto, newLife } from "../../src/engine/life";
import {
  MIGRATIONS,
  SCHEMA_VERSION,
  exportText,
  isSnapshotOf,
  parseImport,
  readSave,
  restoreLife,
  resave,
  toSave,
} from "../../src/engine/save";
import { makeCountry } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa", iso3: "AAA" });

const fixtureText = (name: string) => readFileSync(new URL(`../fixtures/saves/${name}.json`, import.meta.url), "utf8");
const fixtures = {
  "v1-in-progress": fixtureText("v1-in-progress"),
  "v1-finished": fixtureText("v1-finished"),
} as const;
const names = Object.keys(fixtures) as (keyof typeof fixtures)[];

type Raw = Record<string, unknown>;
const parsed = (name: keyof typeof fixtures) => JSON.parse(fixtures[name]) as Raw;

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) freeze(inner);
    Object.freeze(value);
  }
  return value;
}

describe("TD-002: saves written by version 1 keep loading", () => {
  it("are what they say they are", () => {
    for (const name of names) {
      expect(parsed(name)).toMatchObject({ schemaVersion: 1, dataVersion: "fixture-data-1" });
    }
    expect(parsed("v1-in-progress")).toMatchObject({ years: 25, waiting: false, seed: "fixture-amber-1" });
    expect(parsed("v1-in-progress").journal).toHaveLength(1);
    expect(parsed("v1-finished").epitaph).toBe("Kept bees, and kept her word.");
  });

  it.each(names)("%s: reads at the current schema", (name) => {
    const read = parseImport(fixtures[name]);
    expect(read.ok && read.save.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it.each(names)("%s: restores from its snapshot, exactly, with the versions it was made with", (name) => {
    const read = parseImport(fixtures[name]);
    if (!read.ok) throw new Error("fixture does not read");
    const { save } = read;
    const restored = restoreLife(save, country, { dataVersion: save.dataVersion, contentVersion: save.contentVersion });
    expect(restored).toMatchObject({ ok: true, source: "snapshot", exact: true });
    if (!restored.ok) return;
    expect(restored.life.history).toHaveLength(save.years);
    expect(restored.life.person.alive).toBe(name === "v1-in-progress");
    // The writer of today and the reader of today agree: the restored life saves as the migrated file.
    expect(resave(restored.life, save)).toEqual(save);
    expect(JSON.parse(exportText(resave(restored.life, save)))).toEqual(save);
  });

  it("plays on: a life in progress lives another year and saves again", () => {
    const read = parseImport(fixtures["v1-in-progress"]);
    if (!read.ok) throw new Error("fixture does not read");
    const { save } = read;
    const restored = restoreLife(save, country, { dataVersion: save.dataVersion, contentVersion: save.contentVersion });
    if (!restored.ok) throw new Error("fixture does not restore");
    const next = advanceAuto(restored.life, country);
    expect(next.history).toHaveLength(save.years + 1);
    const again = toSave(next, {
      dataVersion: save.dataVersion,
      contentVersion: save.contentVersion,
      now: save.updatedAt,
    });
    expect(readSave(JSON.parse(exportText(again))).ok).toBe(true);
  });

  it("keep what the player wrote: the epitaph, the journal and the settings changed along the way", () => {
    const read = parseImport(fixtures["v1-in-progress"]);
    const finished = parseImport(fixtures["v1-finished"]);
    if (!read.ok || !finished.ok) throw new Error("fixture does not read");
    expect(read.save.journal).toEqual([{ age: 20, text: "Left home for the first time." }]);
    expect(read.save.settingsLog).toHaveLength(1);
    expect(read.save.planLog).toHaveLength(1);
    expect(finished.save.epitaph).toBe("Kept bees, and kept her word.");
  });
});

/** The invented version 2: a person's money gains `assets`, in the snapshot and in any year waiting on a decision. */
const addAssets = (save: Raw): Raw => {
  const upgrade = (person: Raw): Raw => ({ ...person, money: { ...(person.money as Raw), assets: [] } });
  const snapshot = save.snapshot as Raw;
  const turn = snapshot.turn as Raw | undefined;
  return {
    ...save,
    snapshot: {
      ...snapshot,
      person: upgrade(snapshot.person as Raw),
      ...(turn ? { turn: { ...turn, person: upgrade(turn.person as Raw) } } : {}),
    },
  };
};
const withoutSnapshot = (save: Raw): Raw => {
  const rest = { ...save };
  delete rest.snapshot;
  return rest;
};
const rehearsal = { 1: addAssets };
const REHEARSED = 2;

describe("TD-002: rehearsal of a migration from version 1 to a version 2", () => {
  it.each(names)("%s: migrates without touching the file it was given, or the logs", (name) => {
    const original = freeze(parsed(name));
    const read = readSave(original, rehearsal, REHEARSED);
    if (!read.ok) throw new Error(`rehearsal failed: ${read.reason}`);
    expect(read.save.schemaVersion).toBe(REHEARSED);
    for (const key of [
      "seed",
      "countryIso3",
      "settings",
      "decisions",
      "settingsLog",
      "planLog",
      "years",
      "waiting",
    ] as const) {
      expect(read.save[key]).toEqual(original[key]);
    }
    expect(read.save.epitaph).toEqual(original.epitaph);
    expect(read.save.journal).toEqual(original.journal);
    expect((read.save.snapshot.person.money as unknown as Raw).assets).toEqual([]);
  });

  it.each(names)("%s: the migrated snapshot is sound and the life comes back from it", (name) => {
    const read = readSave(parsed(name), rehearsal, REHEARSED);
    if (!read.ok) throw new Error("rehearsal failed");
    expect(isSnapshotOf(read.save.snapshot, read.save)).toBe(true);
    const { save } = read;
    const restored = restoreLife(save, country, { dataVersion: save.dataVersion, contentVersion: save.contentVersion });
    expect(restored).toMatchObject({ ok: true, source: "snapshot" });
    expect(restored.ok && (restored.life.person.money as unknown as Raw).assets).toEqual([]);
  });

  it("an old snapshot passes the check unless the migration upgrades it, which is why a migration must", () => {
    const original = parsed("v1-in-progress");
    const read = readSave(original, { 1: (save) => save }, REHEARSED);
    expect(read.ok && isSnapshotOf(read.save.snapshot, read.save)).toBe(true);
    expect(read.ok && (read.save.snapshot.person.money as unknown as Raw).assets).toBeUndefined();
  });

  it("a migration that drops the snapshot gets the life back from the seed and the logs", () => {
    let life = newLife({ seed: "rehearsal-1", country, settings: { pace: "every-year" } });
    while (life.person.alive && life.history.length < 20) life = advanceAuto(life, country);
    const versions = { dataVersion: "d", contentVersion: "c", now: "2026-10-29T10:00:00.000Z" };
    const file = JSON.parse(exportText(toSave(life, versions))) as Raw;
    const read = readSave(file, { 1: withoutSnapshot }, REHEARSED);
    if (!read.ok) throw new Error("rehearsal failed");
    const restored = restoreLife(read.save, country, versions);
    expect(restored).toMatchObject({ ok: true, source: "replay", exact: true });
    expect(restored.ok && restored.life).toEqual(life);
    const next = (state: typeof life) => advance(state, { kind: "continue" }, country).state;
    expect(restored.ok && next(restored.life)).toEqual(next(life));
  });

  it("a migration that fails leaves the file alone and the life damaged, not lost", () => {
    const original = freeze(parsed("v1-in-progress"));
    const broken = {
      1: () => {
        throw new Error("rehearsal");
      },
    };
    expect(readSave(original, broken, REHEARSED)).toEqual({ ok: false, reason: "damaged" });
    expect(original.schemaVersion).toBe(1);
    expect(parseImport(fixtures["v1-in-progress"]).ok).toBe(true);
  });

  it("is not the shipped migration: version 1 is still the first, so nothing is migrated today", () => {
    expect(Object.keys(MIGRATIONS)).toHaveLength(SCHEMA_VERSION - 1);
  });
});

// So that a file is never imported into a game that cannot read it, and the player is told which it is.
describe("TD-002: files that are not for this game", () => {
  it("a version 1 file in a game that has dropped the migration is unsupported, not damaged", () => {
    expect(readSave(parsed("v1-finished"), {}, REHEARSED)).toEqual({ ok: false, reason: "unsupported" });
  });

  it("a save made by a later game is unsupported", () => {
    const later = { ...parsed("v1-finished"), schemaVersion: SCHEMA_VERSION + 1 };
    expect(parseImport(JSON.stringify(later))).toEqual({ ok: false, reason: "unsupported" });
  });
});
