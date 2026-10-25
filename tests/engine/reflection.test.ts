import { describe, expect, it } from "vitest";
import { reflections } from "../../src/content/reflections";
import { en } from "../../src/content/strings/en";
import { advanceAuto, newLife } from "../../src/engine/life";
import {
  JOURNAL_MAX_LENGTH,
  journalLine,
  reflectionPrompt,
  withJournalEntry,
  type ReflectionDef,
} from "../../src/engine/reflection";
import { SCHEMA_VERSION, readSave, restoreLife, toSave } from "../../src/engine/save";
import { summarize } from "../../src/engine/summary";
import type { EventRecord, LifeState, YearRecord } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa", iso3: "AAA" });

const event = (id: string, extra: Partial<EventRecord> = {}): EventRecord => ({
  id,
  textKey: `event.${id}`,
  effects: [],
  ...extra,
});
const stats = { health: 70, happiness: 60, belonging: 60, skills: 40 };
const year = (age: number, events: EventRecord[] = [], extra: Partial<YearRecord> = {}): YearRecord => ({
  age,
  stage: "adulthood",
  stageChanged: false,
  stats,
  events,
  ...extra,
});

describe("UI-007: reflection prompts", () => {
  it("has at least 15 prompts, each with its own id and a text that exists", () => {
    expect(reflections.length).toBeGreaterThanOrEqual(15);
    expect(new Set(reflections.map((r) => r.id)).size).toBe(reflections.length);
    for (const reflection of reflections) {
      expect(en, reflection.id).toHaveProperty(reflection.text);
      // A prompt is a question or an invitation, not a heading, and short enough to read at a glance.
      expect(en[reflection.text]!.length, reflection.id).toBeLessThan(200);
    }
  });

  it("gives every prompt a trigger", () => {
    for (const { id, events, stage, effect } of reflections) {
      expect(events || stage || effect, id).toBeTruthy();
    }
  });

  it("only names events and stages that exist", () => {
    const stages = ["childhood", "adolescence", "youth", "adulthood", "midlife", "elder"];
    for (const { id, stage } of reflections) if (stage) expect(stages, id).toContain(stage);
  });

  describe("choosing the prompt of a year", () => {
    const loss = reflections.find((r) => r.id === "loss.first")!;
    const lossAgain = reflections.find((r) => r.id === "loss.later")!;
    const lossEvent = (loss.events ?? [])[0]!.replace(".*", ".x");

    it("is none for a quiet year", () => {
      expect(reflectionPrompt([year(30), year(31)])).toBeUndefined();
    });

    it("comes from an event of the year", () => {
      const history = [year(30), year(31, [event(lossEvent)])];
      expect(reflectionPrompt(history)?.id).toBe("loss.first");
    });

    it("is the first in the catalog when several match, so one year gets one prompt", () => {
      const history = [year(30, [event("work.retires"), event(lossEvent)])];
      expect(reflectionPrompt(history)?.id).toBe("loss.first");
    });

    it("moves on to the later version once the first has been offered", () => {
      const history = [year(30, [event(lossEvent)]), year(31), year(32, [event(lossEvent)])];
      expect(reflectionPrompt(history)?.id).toBe(lossAgain.id);
      expect(reflectionPrompt(history, 0)?.id).toBe("loss.first");
    });

    it("matches an event id by prefix when the catalog says so", () => {
      const defs: ReflectionDef[] = [{ id: "a", text: "t", events: ["work.starts.*"] }];
      expect(reflectionPrompt([year(20, [event("work.starts.farm.informal")])], 0, defs)?.id).toBe("a");
      expect(reflectionPrompt([year(20, [event("work.started")])], 0, defs)).toBeUndefined();
    });

    it("fires for the year a stage of life is reached", () => {
      const history = [year(11), year(12, [], { stage: "adolescence", stageChanged: true })];
      expect(reflectionPrompt(history)?.id).toBe("stage.adolescence");
    });

    it("fires for a move between countryside and city", () => {
      const moved = event("youth.cheap_room", { effects: [{ effect: { move: "urban" }, cause: "choice" }] });
      expect(reflectionPrompt([year(22, [moved])])?.id).toBe("move");
    });

    it("is none for the year of a death, which the closing passage tells", () => {
      expect(reflectionPrompt([year(30, [event(lossEvent)], { died: true })])).toBeUndefined();
    });

    it("is none for an empty history", () => {
      expect(reflectionPrompt([])).toBeUndefined();
    });
  });

  describe("in lives played out", () => {
    const lives: LifeState[] = [];
    for (let i = 0; i < 12; i++) {
      let life = newLife({ seed: `reflect-${i}`, country, settings: { pace: "every-year" } });
      while (life.person.alive) life = advanceAuto(life, country);
      lives.push(life);
    }

    it("offers a prompt in some years, never in more than half of them, and never in the year of death", () => {
      for (const life of lives) {
        const offered = life.history.map((_, i) => reflectionPrompt(life.history, i));
        const count = offered.filter(Boolean).length;
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThanOrEqual(Math.ceil(life.history.length / 2));
        expect(offered.at(-1)).toBeUndefined();
      }
    });

    it("is decided by the years already lived, so it does not change as the life goes on", () => {
      const life = lives[0]!;
      for (let i = 0; i < life.history.length; i++) {
        expect(reflectionPrompt(life.history.slice(0, i + 1))?.id).toBe(reflectionPrompt(life.history, i)?.id);
      }
    });
  });
});

describe("UI-007: the journal", () => {
  const born = () => newLife({ seed: "journal", country, settings: { pace: "every-year" } });

  it("keeps a line for an age, tidied", () => {
    const life = withJournalEntry(born(), { age: 8, text: "  The  rain\n came early.  " });
    expect(life.journal).toEqual([{ age: 8, text: "The rain came early." }]);
  });

  it("remembers which prompt a line answered", () => {
    const life = withJournalEntry(born(), { age: 8, prompt: "loss.first", text: "I kept her scarf." });
    expect(life.journal).toEqual([{ age: 8, prompt: "loss.first", text: "I kept her scarf." }]);
    expect(journalLine(life, 8, "loss.first")).toBe("I kept her scarf.");
    expect(journalLine(life, 8)).toBeUndefined();
  });

  it("replaces the line for the same age and prompt, and keeps others", () => {
    let life = withJournalEntry(born(), { age: 8, text: "one" });
    life = withJournalEntry(life, { age: 8, prompt: "loss.first", text: "two" });
    life = withJournalEntry(life, { age: 8, text: "three" });
    expect(life.journal).toEqual([
      { age: 8, text: "three" },
      { age: 8, prompt: "loss.first", text: "two" },
    ]);
  });

  it("keeps the lines in the order of the years", () => {
    let life = withJournalEntry(born(), { age: 30, text: "later" });
    life = withJournalEntry(life, { age: 12, text: "earlier" });
    expect(life.journal?.map((entry) => entry.age)).toEqual([12, 30]);
  });

  it("removes a line when it is emptied, and the whole journal when none is left", () => {
    let life = withJournalEntry(born(), { age: 8, text: "one" });
    life = withJournalEntry(life, { age: 9, text: "two" });
    life = withJournalEntry(life, { age: 8, text: "   " });
    expect(life.journal).toEqual([{ age: 9, text: "two" }]);
    life = withJournalEntry(life, { age: 9, text: "" });
    expect(life).not.toHaveProperty("journal");
  });

  it("cuts a long line to the limit, by characters and not by code units", () => {
    const life = withJournalEntry(born(), { age: 8, text: "é".repeat(JOURNAL_MAX_LENGTH + 40) });
    expect(Array.from(life.journal![0]!.text)).toHaveLength(JOURNAL_MAX_LENGTH);
    const emoji = withJournalEntry(born(), { age: 8, text: "🌳".repeat(JOURNAL_MAX_LENGTH + 5) });
    expect(Array.from(emoji.journal![0]!.text)).toHaveLength(JOURNAL_MAX_LENGTH);
  });

  it("does not change the life it was given, and changes nothing else about it", () => {
    const before = born();
    const copy = structuredClone(before);
    const after = withJournalEntry(before, { age: 1, text: "x" });
    expect(before).toEqual(copy);
    expect({ ...after, journal: undefined }).toEqual({ ...before, journal: undefined });
  });

  it("does not change how the life goes on: a life with a journal is lived the same", () => {
    const plain = advanceAuto(born(), country);
    const written = advanceAuto(withJournalEntry(born(), { age: 0, text: "hello" }), country);
    expect(written.history).toEqual(plain.history);
    expect(written.person).toEqual(plain.person);
  });
});

describe("UI-007: the journal in a save", () => {
  const versions = { dataVersion: "d1", contentVersion: "c1" };
  const now = "2026-10-25T10:00:00.000Z";
  const lifeAt = (years: number): LifeState => {
    let life = newLife({ seed: "journal-save", country, settings: { pace: "every-year" } });
    while (life.person.alive && life.history.length < years) life = advanceAuto(life, country);
    return life;
  };

  it("is saved with the life, and a save without one has no such field", () => {
    const life = lifeAt(10);
    expect(toSave(life, { ...versions, now })).not.toHaveProperty("journal");
    const written = withJournalEntry(life, { age: 10, prompt: "loss.first", text: "kept" });
    expect(toSave(written, { ...versions, now }).journal).toEqual(written.journal);
  });

  it("comes back with the life from the snapshot, and from a replay", () => {
    const written = withJournalEntry(lifeAt(10), { age: 9, text: "the long walk" });
    const save = JSON.parse(JSON.stringify(toSave(written, { ...versions, now }))) as ReturnType<typeof toSave>;
    const read = readSave(save);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const fromSnapshot = restoreLife(read.save, country, versions);
    expect(fromSnapshot.ok && fromSnapshot.life.journal).toEqual(written.journal);
    const fromReplay = restoreLife({ ...read.save, snapshot: null } as never, country, versions);
    expect(fromReplay.ok && fromReplay.source).toBe("replay");
    expect(fromReplay.ok && fromReplay.life.journal).toEqual(written.journal);
  });

  it("loads a save made before there was a journal, with no change of schema", () => {
    const older = JSON.parse(JSON.stringify(toSave(lifeAt(6), { ...versions, now })));
    expect(older).not.toHaveProperty("journal");
    expect(older.schemaVersion).toBe(SCHEMA_VERSION);
    const read = readSave(older);
    const restored = read.ok ? restoreLife(read.save, country, versions) : undefined;
    expect(restored?.ok && restored.life.journal).toBeFalsy();
    expect(restored?.ok).toBe(true);
  });
});

describe("SUM-005: the journal in the summary", () => {
  it("carries the lines, and none when the player wrote none", () => {
    let life = newLife({ seed: "journal-summary", country, settings: { pace: "every-year" } });
    while (life.person.alive) life = advanceAuto(life, country);
    expect(summarize(life, country)).not.toHaveProperty("journal");
    const written = withJournalEntry(life, { age: 20, text: "a good year" });
    expect(summarize(written, country).journal).toEqual([{ age: 20, text: "a good year" }]);
  });
});

describe("UI-007: matching an event id", () => {
  const id = (events: string[], event: string) =>
    reflectionPrompt([year(20, [{ id: event, textKey: "k", effects: [] }])], 0, [{ id: "a", text: "t", events }]);

  it("matches a whole id, and a pattern with a star anywhere in it", () => {
    expect(id(["school.left"], "school.left")).toBeDefined();
    expect(id(["school.left"], "school.left.primary")).toBeUndefined();
    expect(id(["health.*.begins"], "health.malaria.begins")).toBeDefined();
    expect(id(["health.*.begins"], "health.malaria.worsens")).toBeUndefined();
    expect(id(["health.*.begins"], "health.begins")).toBeUndefined();
    expect(id(["work.starts.*"], "work.starts.farm")).toBeDefined();
    expect(id(["work.starts.*"], "work.starts")).toBeUndefined();
    expect(id(["a.*.b.*.c"], "a.x.b.y.c")).toBeDefined();
    expect(id(["a.*.b.*.c"], "a.x.c")).toBeUndefined();
  });
});
