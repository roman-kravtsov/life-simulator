// The save file (SAVE-001, SAVE-004, SAVE-005, design 2.4): what is stored for a life, how an older one is
// brought up to date, and how a life is restored from it. Pure: the browser adapters in src/save write and
// read the JSON, and the caller loads the country.
import { catalog as contentCatalog } from "../content/events";
import { decisionCard } from "./life";
import type { EventCatalog } from "./events";
import { replay, ReplayError } from "./replay";
import type { DecisionLogEntry, JournalEntry, LifeState, PlanLogEntry, Settings, SettingsLogEntry } from "./types";
import type { Country } from "./world/types";

/** The version of the save format this code writes and reads. */
export const SCHEMA_VERSION = 1;

export interface SaveFile {
  schemaVersion: number;
  /** The world data the life was lived with (`DATA_VERSION`, in the country index). */
  dataVersion: string;
  /** The events and text the life was lived with (`CONTENT_VERSION`). */
  contentVersion: string;
  seed: string;
  countryIso3: string;
  /** The settings the life began with; `settingsLog` is applied on top of them at the age each entry names. */
  settings: Settings;
  decisions: DecisionLogEntry[];
  settingsLog: SettingsLogEntry[];
  planLog: PlanLogEntry[];
  /** How many years the life had recorded: where a replay stops. */
  years: number;
  /** Whether the next year was waiting on a decision, which a replay stops at without answering. */
  waiting: boolean;
  /** The player's few words for the person (DEATH-004). */
  epitaph?: string;
  /** The lines the player wrote along the way (UI-007). Absent when there are none, as in every save made before the journal. */
  journal?: JournalEntry[];
  /** The life as it stood, so loading is instant. A cache: the seed and the logs are the real save. */
  snapshot: LifeState;
  createdAt: string;
  updatedAt: string;
}

export interface SaveVersions {
  dataVersion: string;
  contentVersion: string;
}

export interface SaveOptions extends SaveVersions {
  /** ISO time of this save, from the caller's clock. */
  now: string;
  /** When the life was first saved; defaults to `now`. */
  createdAt?: string;
}

/** The save file for a life as it stands. */
export function toSave(life: LifeState, { dataVersion, contentVersion, now, createdAt }: SaveOptions): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    dataVersion,
    contentVersion,
    seed: life.seed,
    countryIso3: life.person.countryIso3,
    settings: life.startSettings ?? life.settings,
    decisions: life.decisions,
    settingsLog: life.settingsLog ?? [],
    planLog: life.planLog ?? [],
    years: life.history.length,
    waiting: life.turn !== undefined,
    ...(life.epitaph ? { epitaph: life.epitaph } : {}),
    ...(life.journal?.length ? { journal: life.journal } : {}),
    snapshot: life,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

type Raw = Record<string, unknown>;

/**
 * Brings a save of an older schema up to the next one: `MIGRATIONS[n]` turns a version n save into a
 * version n + 1 one. There is none yet: version 1 is the first.
 */
export type Migrations = Readonly<Record<number, (save: Raw) => Raw>>;

export const MIGRATIONS: Migrations = {};

const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const isArray = Array.isArray;
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export type ReadResult = { ok: true; save: SaveFile } | { ok: false; reason: "unsupported" | "damaged" };

/** The parts of a save a replay needs, which a damaged snapshot must not be able to take down. */
function hasLogs(save: Raw): boolean {
  return (
    typeof save.seed === "string" &&
    typeof save.countryIso3 === "string" &&
    typeof save.dataVersion === "string" &&
    typeof save.contentVersion === "string" &&
    isObject(save.settings) &&
    isArray(save.decisions) &&
    isArray(save.settingsLog) &&
    isArray(save.planLog) &&
    Number.isInteger(save.years) &&
    typeof save.waiting === "boolean" &&
    typeof save.createdAt === "string" &&
    typeof save.updatedAt === "string"
  );
}

/**
 * A stored save, parsed and migrated to the current schema (SAVE-004). A save from a newer version of the
 * game is `unsupported`, and one that has lost the seed or the logs is `damaged`. The snapshot is not looked
 * at here: `restoreLife` decides whether to trust it.
 */
export function readSave(raw: unknown, migrations: Migrations = MIGRATIONS, current = SCHEMA_VERSION): ReadResult {
  if (!isObject(raw) || !Number.isInteger(raw.schemaVersion) || (raw.schemaVersion as number) < 1) {
    return { ok: false, reason: "damaged" };
  }
  let save: Raw = raw;
  let version = raw.schemaVersion as number;
  if (version > current) return { ok: false, reason: "unsupported" };
  while (version < current) {
    const migrate = migrations[version];
    if (!migrate) return { ok: false, reason: "unsupported" };
    try {
      save = { ...migrate(save), schemaVersion: ++version };
    } catch {
      return { ok: false, reason: "damaged" };
    }
  }
  return hasLogs(save) ? { ok: true, save: save as unknown as SaveFile } : { ok: false, reason: "damaged" };
}

/** The lines of a stored journal that have the shape of one: damaged storage must not take a life down with it. */
function soundJournal(journal: unknown): JournalEntry[] {
  if (!isArray(journal)) return [];
  return journal.filter(
    (entry): entry is JournalEntry =>
      isObject(entry) &&
      Number.isInteger(entry.age) &&
      typeof entry.text === "string" &&
      (entry.prompt === undefined || typeof entry.prompt === "string"),
  );
}

const STATS = ["health", "happiness", "belonging", "skills"];

/** True when the snapshot has the shape of a life that matches the logs beside it. Not a full schema check. */
export function isSnapshotOf(snapshot: unknown, save: SaveFile): snapshot is LifeState {
  if (!isObject(snapshot) || snapshot.seed !== save.seed) return false;
  const { person } = snapshot;
  if (!isObject(person) || typeof person.name !== "string" || !Number.isInteger(person.age)) return false;
  if (typeof person.alive !== "boolean" || person.countryIso3 !== save.countryIso3) return false;
  if (!isObject(person.stats) || STATS.some((id) => !isNumber((person.stats as Raw)[id]))) return false;
  if (!isObject(person.traits) || !isObject(person.education) || !isObject(person.work) || !isObject(person.money)) {
    return false;
  }
  if (!isArray(person.relationships) || !isArray(person.conditions) || !isArray(person.scheduled)) return false;
  if (!isObject(person.flags) || !isObject(snapshot.settings)) return false;
  if ((snapshot.turn !== undefined) !== save.waiting) return false;
  const { history, decisions } = snapshot;
  if (!isArray(history) || history.length !== save.years) return false;
  if (
    history.some((year) => !isObject(year) || !isNumber(year.age) || !isArray(year.events) || !isObject(year.stats))
  ) {
    return false;
  }
  if (!isArray(decisions) || decisions.length !== save.decisions.length) return false;
  // A life that is over has its death, and one that is not has none.
  if (person.alive === (snapshot.death !== undefined)) return false;
  const { turn } = snapshot;
  if (turn !== undefined) {
    if (!isObject(turn) || !isObject(turn.person) || !isArray(turn.pending) || !isObject(turn.decision)) return false;
    if (typeof turn.decision.eventId !== "string") return false;
  }
  return true;
}

export type RestoreResult =
  | {
      ok: true;
      life: LifeState;
      /** Whether the snapshot was used, or the life was rebuilt from its seed and logs (SAVE-005). */
      source: "snapshot" | "replay";
      /**
       * False when the save was made with other data or content than this version has. The life loads, but
       * a replay of it may no longer give the same years (RNG-004).
       */
      exact: boolean;
    }
  | { ok: false; reason: "damaged" };

const withoutTurn = (life: LifeState): LifeState => {
  const copy = { ...life };
  delete copy.turn;
  return copy;
};

/**
 * The life in a save: its snapshot when that has the shape of a life that matches the logs, otherwise the
 * life lived again from the seed and the logs (SAVE-005). The snapshot is trusted over a replay, because only
 * the data and content are versioned: a change to the engine itself (a retuned model, say) would make a
 * replay of a life in progress a different life from the one the player has been living. A waiting decision
 * that this version of the game no longer has is dropped, and the year starts again when the player continues.
 */
export function restoreLife(
  save: SaveFile,
  country: Country,
  versions: SaveVersions,
  catalog: EventCatalog = contentCatalog,
): RestoreResult {
  const exact = save.dataVersion === versions.dataVersion && save.contentVersion === versions.contentVersion;
  const finish = (life: LifeState, source: "snapshot" | "replay"): RestoreResult => {
    // What the player wrote is not part of what a replay lives again, so it is put back from the save.
    const kept: LifeState = {
      ...life,
      ...(save.epitaph ? { epitaph: save.epitaph } : {}),
      ...(soundJournal(save.journal).length > 0 ? { journal: soundJournal(save.journal) } : {}),
    };
    try {
      decisionCard(kept, country, catalog);
      return { ok: true, life: kept, source, exact };
    } catch {
      return kept.turn ? { ok: true, life: withoutTurn(kept), source, exact } : { ok: false, reason: "damaged" };
    }
  };
  if (isSnapshotOf(save.snapshot, save)) return finish(save.snapshot, "snapshot");
  try {
    return finish(replay(save, country, catalog), "replay");
  } catch (error) {
    if (error instanceof ReplayError) return { ok: false, reason: "damaged" };
    throw error;
  }
}
