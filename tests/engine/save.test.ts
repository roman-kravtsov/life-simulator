import { describe, expect, it } from "vitest";
import { createCatalog } from "../../src/engine/events";
import { advance, advanceAuto, newLife, withEpitaph, withSettings } from "../../src/engine/life";
import {
  MIGRATIONS,
  SCHEMA_VERSION,
  isSnapshotOf,
  readSave,
  restoreLife,
  toSave,
  type SaveFile,
} from "../../src/engine/save";
import type { LifeState } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa", iso3: "AAA" });
const versions = { dataVersion: "d1", contentVersion: "c1" };
const now = "2026-10-25T10:00:00.000Z";

function lifeAt(years: number, seed = "save-1"): LifeState {
  let life = newLife({ seed, country, settings: { pace: "every-year" } });
  while (life.person.alive && life.history.length < years) life = advanceAuto(life, country);
  return life;
}

/** A life stopped at a decision, found by trying seeds. */
function waitingLife(): LifeState {
  for (let i = 0; i < 40; i++) {
    let life = newLife({ seed: `waiting-${i}`, country, settings: { pace: "every-year" } });
    while (life.person.alive && !life.turn) life = advance(life, { kind: "continue" }, country).state;
    if (life.turn) return life;
  }
  throw new Error("no life reached a decision");
}

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const saved = (life: LifeState) => toSave(life, { ...versions, now });

describe("SAVE-001: what a save holds", () => {
  it("has the seed, the country, the versions, the logs, the years reached and a snapshot", () => {
    const life = withSettings(lifeAt(12), { softening: true });
    const save = saved(life);
    expect(save).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      dataVersion: "d1",
      contentVersion: "c1",
      seed: "save-1",
      countryIso3: "AAA",
      years: 12,
      waiting: false,
      createdAt: now,
      updatedAt: now,
    });
    expect(save.snapshot).toBe(life);
    expect(save.settingsLog).toEqual(life.settingsLog);
    expect(save.decisions).toEqual(life.decisions);
  });

  it("keeps the settings the life began with, and the changes in the log", () => {
    const life = withSettings(lifeAt(5), { softening: true });
    expect(life.settings.softening).toBe(true);
    expect(saved(life).settings.softening).toBe(false);
  });

  it("keeps when the life was first saved, and the epitaph", () => {
    const life = withEpitaph(lifeAt(3), "Kept bees");
    const save = toSave(life, { ...versions, now, createdAt: "2026-10-01T00:00:00.000Z" });
    expect(save.createdAt).toBe("2026-10-01T00:00:00.000Z");
    expect(save.updatedAt).toBe(now);
    expect(save.epitaph).toBe("Kept bees");
  });

  it("notes a decision that is waiting", () => {
    expect(saved(waitingLife()).waiting).toBe(true);
  });

  it("goes through JSON and back unchanged", () => {
    expect(json(saved(lifeAt(20)))).toEqual(saved(lifeAt(20)));
    expect(json(saved(waitingLife()))).toEqual(saved(waitingLife()));
  });
});

describe("SAVE-004: schema versions and migrations", () => {
  it("reads a save of the current schema", () => {
    const save = saved(lifeAt(4));
    expect(readSave(json(save))).toEqual({ ok: true, save });
  });

  it("says a save from a newer game is unsupported, and one with no version or no seed is damaged", () => {
    expect(readSave({ ...saved(lifeAt(2)), schemaVersion: SCHEMA_VERSION + 1 })).toEqual({
      ok: false,
      reason: "unsupported",
    });
    for (const raw of [null, "text", 7, [], {}, { schemaVersion: 0 }, { ...saved(lifeAt(2)), seed: undefined }]) {
      expect(readSave(raw)).toEqual({ ok: false, reason: "damaged" });
    }
    expect(readSave({ ...saved(lifeAt(2)), decisions: "none" })).toEqual({ ok: false, reason: "damaged" });
  });

  it("has no migrations yet, because version 1 is the first", () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(Object.keys(MIGRATIONS)).toEqual([]);
  });

  it("loads an older save by running every migration between its version and the current one", () => {
    // SYNTHETIC: the game has only one schema so far, so this tests the machinery with an invented history.
    // Pretend version 1 stored `plans` where version 2 has `planLog`, and version 2 had no `waiting` flag.
    const current = saved(lifeAt(6));
    const { planLog, waiting, ...rest } = current;
    void waiting;
    const old = { ...rest, schemaVersion: 1, plans: planLog };
    const migrations = {
      1: ({ plans, ...others }: Record<string, unknown>) => ({ ...others, planLog: plans }),
      2: (save: Record<string, unknown>) => ({ ...save, waiting: false }),
    };
    const result = readSave(json(old), migrations, 3);
    expect(result).toEqual({ ok: true, save: { ...current, schemaVersion: 3 } });
  });

  it("is unsupported when a migration is missing, and damaged when one fails", () => {
    const old = { ...saved(lifeAt(2)), schemaVersion: 1 };
    expect(readSave(old, {}, 2)).toEqual({ ok: false, reason: "unsupported" });
    const failing = {
      1: () => {
        throw new Error("cannot");
      },
    };
    expect(readSave(old, failing, 2)).toEqual({ ok: false, reason: "damaged" });
  });
});

describe("the snapshot check", () => {
  const save = saved(lifeAt(8));
  it("accepts the snapshot of the save", () => {
    expect(isSnapshotOf(json(save.snapshot), save)).toBe(true);
  });
  it("turns down what is not a life, or is another life, or has lost the years the save counts", () => {
    const { snapshot } = json(save);
    expect(isSnapshotOf(undefined, save)).toBe(false);
    expect(isSnapshotOf("life", save)).toBe(false);
    expect(isSnapshotOf({ ...snapshot, seed: "other" }, save)).toBe(false);
    expect(isSnapshotOf({ ...snapshot, history: snapshot.history.slice(1) }, save)).toBe(false);
    expect(isSnapshotOf({ ...snapshot, person: { ...snapshot.person, stats: { health: "high" } } }, save)).toBe(false);
    expect(isSnapshotOf({ ...snapshot, person: { ...snapshot.person, relationships: null } }, save)).toBe(false);
    expect(isSnapshotOf({ ...snapshot, person: { ...snapshot.person, alive: false } }, save)).toBe(false);
    expect(isSnapshotOf({ ...snapshot, decisions: [{}] }, save)).toBe(false);
  });
});

describe("SAVE-005: restoring a life, from the snapshot or by replay", () => {
  const raw = (save: SaveFile) => json(save);

  it("uses the snapshot when it is sound", () => {
    const life = lifeAt(15);
    const result = restoreLife(raw(saved(life)), country, versions);
    expect(result).toMatchObject({ ok: true, source: "snapshot", exact: true });
    expect(result.ok && result.life).toEqual(life);
  });

  it("rebuilds the life from its seed and logs when the snapshot is missing, truncated or nonsense", () => {
    const life = lifeAt(15);
    for (const broken of [
      undefined,
      null,
      "garbage",
      {},
      { seed: life.seed },
      { ...life, history: life.history.slice(0, 3) },
    ]) {
      const save = { ...raw(saved(life)), snapshot: broken } as unknown as SaveFile;
      const result = restoreLife(save, country, versions);
      expect(result).toMatchObject({ ok: true, source: "replay" });
      expect(result.ok && result.life).toEqual(life);
    }
  });

  it("rebuilds a finished life, with the epitaph", () => {
    let life = newLife({ seed: "finished", country, settings: { pace: "every-year" } });
    while (life.person.alive) life = advanceAuto(life, country);
    const written = withEpitaph(life, "Kept bees");
    const save = { ...raw(saved(written)), snapshot: null } as unknown as SaveFile;
    const result = restoreLife(save, country, versions);
    expect(result.ok && result.life).toEqual(written);
  });

  it("trusts a sound snapshot over a replay, because only data and content are versioned and the engine may have changed", () => {
    const life = lifeAt(15);
    const changed = raw(saved(life));
    changed.snapshot.person.stats.health = 1;
    const result = restoreLife(changed, country, versions);
    expect(result).toMatchObject({ ok: true, source: "snapshot" });
    expect(result.ok && result.life.person.stats.health).toBe(1);
  });

  it("is damaged, not a crash, when a log entry is not what it should be", () => {
    const life = lifeAt(10);
    const save = { ...raw(saved(life)), snapshot: null, planLog: [null], years: 10 } as unknown as SaveFile;
    expect(restoreLife(save, country, versions)).toEqual({ ok: false, reason: "damaged" });
  });

  it("keeps a snapshot made with other data or content, and says the replay is no longer exact", () => {
    const life = lifeAt(15);
    for (const other of [
      { dataVersion: "d2", contentVersion: "c1" },
      { dataVersion: "d1", contentVersion: "c2" },
    ]) {
      const result = restoreLife(raw(saved(life)), country, other);
      expect(result).toMatchObject({ ok: true, source: "snapshot", exact: false });
      expect(result.ok && result.life).toEqual(life);
    }
  });

  it("restores a life with a decision waiting", () => {
    const life = waitingLife();
    const result = restoreLife(raw(saved(life)), country, versions);
    expect(result.ok && result.life.turn).toEqual(life.turn);
  });

  it("drops a waiting decision that this version of the game no longer has, and the year starts again", () => {
    const crossroads = {
      id: "test.crossroads",
      stage: ["childhood" as const],
      chance: { kind: "fixed" as const, p: 1 },
      text: "event.test.crossroads",
      conditions: [{ age: [8, 8] as [number, number] }],
      choices: [
        {
          id: "stay",
          text: "choice.test.stay",
          default: true,
          outcomes: [{ p: 1, text: "outcome.test.stay", effects: [] }],
        },
      ],
    };
    const catalog = createCatalog([crossroads]);
    let life = newLife({ seed: "dropped", country, settings: { pace: "every-year" } });
    while (!life.turn) life = advance(life, { kind: "continue" }, country, catalog).state;
    expect(life.turn!.decision.eventId).toBe("test.crossroads");
    const empty = createCatalog([]);
    for (const other of [versions, { ...versions, contentVersion: "c2" }]) {
      const result = restoreLife(raw(saved(life)), country, other, empty);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.life.turn).toBeUndefined();
      expect(result.life.history).toEqual(life.history);
      expect(result.life.person).toEqual(life.person);
      // The year can be lived again from where it began.
      expect(advance(result.life, { kind: "continue" }, country, empty).state.person.age).toBe(9);
    }
  });

  it("is damaged when neither the snapshot nor a replay can give the life back", () => {
    const broken = {
      ...raw(saved(waitingLife())),
      snapshot: null,
      decisions: [{ year: 99, eventId: "x", choiceId: "y" }],
    } as unknown as SaveFile;
    expect(restoreLife(broken, country, versions)).toEqual({ ok: false, reason: "damaged" });
  });

  it("restores the same life whichever way it comes back", () => {
    const life = lifeAt(12, "both-ways");
    const fromSnapshot = restoreLife(raw(saved(life)), country, versions);
    const fromReplay = restoreLife({ ...raw(saved(life)), snapshot: null } as unknown as SaveFile, country, versions);
    expect(fromSnapshot.ok && fromReplay.ok && fromSnapshot.life).toEqual(fromReplay.ok && fromReplay.life);
    const next = (r: typeof fromSnapshot) => (r.ok ? advance(r.life, { kind: "continue" }, country).state : undefined);
    expect(next(fromSnapshot)).toEqual(next(fromReplay));
  });
});

describe("the shape of a saved life", () => {
  const topLevel = (life: LifeState) => Object.keys(life).sort();

  // A snapshot is trusted over a replay (restoreLife), so a change to the shape of a life in progress strands
  // every saved one: the first `advance` on it would throw. When this fails, add a migration in `MIGRATIONS`
  // (or make the new field optional and read it defensively), bump `SCHEMA_VERSION` if a migration was added,
  // then update the pin.
  it("is pinned, so that changing it is a decision about saves already made", () => {
    const born = newLife({ seed: "shape", country, settings: { pace: "every-year" } });
    const lived = lifeAt(30, "shape");
    const person = (life: LifeState) => Object.keys(life.person).sort();
    expect({
      schema: SCHEMA_VERSION,
      born: topLevel(born),
      lived: topLevel(lived),
      person: person(lived),
      year: Object.keys(lived.history[lived.history.length - 1]!).sort(),
      saveFile: Object.keys(saved(lived)).sort(),
    }).toMatchInlineSnapshot(`
      {
        "born": [
          "decisions",
          "history",
          "person",
          "seed",
          "settings",
          "startSettings",
        ],
        "lived": [
          "decisions",
          "history",
          "person",
          "seed",
          "settings",
          "startSettings",
        ],
        "person": [
          "age",
          "alive",
          "birthYear",
          "conditions",
          "countryIso3",
          "education",
          "flags",
          "focus",
          "location",
          "marriageDraw",
          "money",
          "name",
          "relationships",
          "scheduled",
          "sex",
          "stage",
          "stats",
          "traits",
          "work",
        ],
        "saveFile": [
          "contentVersion",
          "countryIso3",
          "createdAt",
          "dataVersion",
          "decisions",
          "planLog",
          "schemaVersion",
          "seed",
          "settings",
          "settingsLog",
          "snapshot",
          "updatedAt",
          "waiting",
          "years",
        ],
        "schema": 1,
        "year": [
          "age",
          "drift",
          "events",
          "plan",
          "stage",
          "stageChanged",
          "stats",
          "theme",
        ],
      }
    `);
  });
});
