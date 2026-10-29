import { describe, expect, it } from "vitest";
import { EPITAPH_MAX_LENGTH, advance, advanceAuto, newLife, withEpitaph, withSettings } from "../../src/engine/life";
import { JOURNAL_MAX_LENGTH, withJournalEntry } from "../../src/engine/reflection";
import {
  IMPORT_MAX_LENGTH,
  SCHEMA_VERSION,
  exportFileName,
  exportText,
  parseImport,
  restoreLife,
  resave,
  toSave,
  type SaveFile,
} from "../../src/engine/save";
import type { LifeState } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa", iso3: "AAA" });
const versions = { dataVersion: "d1", contentVersion: "c1" };
const now = "2026-10-29T10:00:00.000Z";
const first = "2026-10-01T08:00:00.000Z";

function lifeAt(years: number, seed = "file-1"): LifeState {
  let life = newLife({ seed, country, settings: { pace: "every-year" } });
  while (life.person.alive && life.history.length < years) life = advanceAuto(life, country);
  return life;
}

function finishedLife(seed = "file-end"): LifeState {
  let life = newLife({ seed, country, settings: { pace: "every-year" } });
  while (life.person.alive) life = advanceAuto(life, country);
  return life;
}

function waitingLife(): LifeState {
  for (let i = 0; i < 40; i++) {
    let life = newLife({ seed: `file-waiting-${i}`, country, settings: { pace: "every-year" } });
    while (life.person.alive && !life.turn) life = advance(life, { kind: "continue" }, country).state;
    if (life.turn) return life;
  }
  throw new Error("no life reached a decision");
}

const saved = (life: LifeState) => toSave(life, { ...versions, now, createdAt: first });
const imported = (save: SaveFile) => {
  const read = parseImport(exportText(save));
  if (!read.ok) throw new Error(`The export did not read back: ${read.reason}`);
  return read.save;
};

describe("SAVE-006: the file a life is exported to", () => {
  it("is the save, as JSON, so the seed and every log travel with it", () => {
    const save = saved(withSettings(lifeAt(12), { softening: true }));
    const parsed = JSON.parse(exportText(save)) as SaveFile;
    expect(parsed).toEqual(save);
    expect(parsed).toMatchObject({ schemaVersion: SCHEMA_VERSION, seed: "file-1", years: 12 });
    expect(parsed.settingsLog).toHaveLength(1);
  });

  it("is named for the seed, with nothing in the name that a file system would refuse", () => {
    expect(exportFileName({ seed: "amber-river-4821" })).toBe("birthright-amber-river-4821.json");
    expect(exportFileName({ seed: "a/b\\c: d?*" })).toBe("birthright-a-b-c-d.json");
    expect(exportFileName({ seed: "" })).toBe("birthright-life.json");
  });
});

describe("SAVE-006: reading a file back", () => {
  it("gives back the save that was exported, for a life in progress, a waiting decision and a finished life", () => {
    for (const life of [
      lifeAt(20),
      waitingLife(),
      withEpitaph(finishedLife(), "Kept bees"),
      withJournalEntry(lifeAt(9), { age: 9, text: "A day by the river." }),
    ]) {
      const save = saved(life);
      expect(imported(save)).toEqual(save);
    }
  });

  it("says why a file is not a life, without throwing", () => {
    const text = exportText(saved(lifeAt(6)));
    const parse = (value: string) => parseImport(value);
    expect(parse("")).toEqual({ ok: false, reason: "unreadable" });
    expect(parse("not json {")).toEqual({ ok: false, reason: "unreadable" });
    expect(parse(text.slice(0, text.length / 2))).toEqual({ ok: false, reason: "unreadable" });
    expect(parse("null")).toEqual({ ok: false, reason: "damaged" });
    expect(parse("[1, 2]")).toEqual({ ok: false, reason: "damaged" });
    expect(parse('{"hello": "world"}')).toEqual({ ok: false, reason: "damaged" });
    expect(parse('{"__proto__": {"schemaVersion": 1}}')).toEqual({ ok: false, reason: "damaged" });
    const lost = JSON.parse(text) as Record<string, unknown>;
    delete lost.seed;
    expect(parse(JSON.stringify(lost))).toEqual({ ok: false, reason: "damaged" });
  });

  it("turns down a file from a newer game without calling it damaged", () => {
    const newer = { ...saved(lifeAt(6)), schemaVersion: SCHEMA_VERSION + 1 };
    expect(parseImport(JSON.stringify(newer))).toEqual({ ok: false, reason: "unsupported" });
  });

  it("turns down a file too big to be a life, before reading it", () => {
    expect(parseImport(" ".repeat(IMPORT_MAX_LENGTH + 1))).toEqual({ ok: false, reason: "tooBig" });
  });

  it("is well within the limit for a whole life", () => {
    expect(exportText(saved(finishedLife())).length).toBeLessThan(IMPORT_MAX_LENGTH / 10);
  });
});

describe("SAVE-006: a life that is imported replays identically", () => {
  it("comes back from the snapshot as the same life, and saves as the same file", () => {
    for (const life of [lifeAt(25), waitingLife(), withEpitaph(finishedLife(), "Kept bees")]) {
      const save = imported(saved(life));
      const restored = restoreLife(save, country, versions);
      expect(restored).toMatchObject({ ok: true, source: "snapshot", exact: true });
      if (!restored.ok) return;
      expect(restored.life).toEqual(life);
      expect(resave(restored.life, save)).toEqual(save);
    }
  });

  it("comes back from the seed and the logs alone as the same life, whatever the file's snapshot says", () => {
    const life = withSettings(lifeAt(30, "file-logs"), { softening: true });
    const save = imported(saved(life));
    const withoutSnapshot = { ...save, snapshot: null } as unknown as SaveFile;
    const restored = restoreLife(withoutSnapshot, country, versions);
    expect(restored).toMatchObject({ ok: true, source: "replay", exact: true });
    expect(restored.ok && restored.life).toEqual(life);
    // Saved again, the file has its snapshot back and is the file that was exported.
    expect(restored.ok && resave(restored.life, save)).toEqual(save);
  });

  it("replays a finished life to the same death", () => {
    const life = withEpitaph(finishedLife("file-death"), "Kept bees");
    const save = { ...imported(saved(life)), snapshot: null } as unknown as SaveFile;
    const restored = restoreLife(save, country, versions);
    expect(restored.ok && restored.life.death).toEqual(life.death);
    expect(restored.ok && restored.life.history).toEqual(life.history);
  });

  it("keeps the versions and the times it was saved with, so an old file still says when it is from", () => {
    const save = imported(saved(lifeAt(8)));
    const restored = restoreLife(save, country, { dataVersion: "d2", contentVersion: "c2" });
    expect(restored).toMatchObject({ ok: true, exact: false });
    const again = restored.ok ? resave(restored.life, save) : undefined;
    expect(again).toMatchObject({ dataVersion: "d1", contentVersion: "c1", createdAt: first, updatedAt: now });
  });

  it("goes on from where it was: the next year is the same one the original life would have lived", () => {
    const life = lifeAt(18);
    const restored = restoreLife(imported(saved(life)), country, versions);
    const next = (state: LifeState) => advance(state, { kind: "continue" }, country).state;
    expect(restored.ok && next(restored.life)).toEqual(next(life));
  });
});

describe("SAVE-006: a file is not trusted to be tidy", () => {
  it("drops an epitaph that is not text, and clips one that is too long", () => {
    const life = lifeAt(10);
    const base = { ...imported(saved(life)) } as unknown as Record<string, unknown>;
    const restore = (epitaph: unknown) => restoreLife({ ...base, epitaph } as unknown as SaveFile, country, versions);
    const odd = restore({ not: "text" });
    expect(odd.ok && odd.life.epitaph).toBeUndefined();
    const long = restore("x".repeat(EPITAPH_MAX_LENGTH + 80));
    expect(long.ok && long.life.epitaph).toHaveLength(EPITAPH_MAX_LENGTH);
  });

  it("clips a journal line that is too long and drops one that is not a line", () => {
    const life = lifeAt(10);
    const base = { ...imported(saved(life)) } as unknown as Record<string, unknown>;
    const journal = [
      { age: 4, text: "y".repeat(JOURNAL_MAX_LENGTH + 50) },
      { age: "five", text: "no" },
      { age: 6, text: { not: "text" } },
    ];
    const restored = restoreLife({ ...base, journal } as unknown as SaveFile, country, versions);
    expect(restored.ok && restored.life.journal).toEqual([{ age: 4, text: "y".repeat(JOURNAL_MAX_LENGTH) }]);
  });

  it("is damaged, not a crash, when the logs are nonsense and there is no snapshot to fall back on", () => {
    const base = imported(saved(lifeAt(10)));
    const save = { ...base, snapshot: null, decisions: [{ year: "x" }], years: 40 } as unknown as SaveFile;
    expect(restoreLife(save, country, versions)).toEqual({ ok: false, reason: "damaged" });
  });
});
