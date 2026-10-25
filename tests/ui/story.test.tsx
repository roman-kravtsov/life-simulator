// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { en } from "../../src/content/strings/en";
import type { EventRecord } from "../../src/engine/types";
import { createTranslator } from "../../src/i18n";
import { App } from "../../src/ui/App";
import { LifeScreen } from "../../src/ui/LifeScreen";
import { createGameStore } from "../../src/ui/store";
import { dataNoteLine } from "../../src/ui/words";
import { makeCountry, testSources, testWorld } from "../fixtures/country";
import { makePerson } from "../fixtures/person";
import { lifeOf, lifeScreenProps } from "./helpers";

const country = makeCountry({ region: "Western Africa" });

/** A life with one told year, for the story under the stats. */
const withEvents = (events: EventRecord[]) => {
  const person = makePerson({ age: 12 });
  return lifeOf(person, {
    history: [{ age: 12, stage: "childhood", stageChanged: false, stats: person.stats, events }],
  });
};

describe("years that pass quietly (TIME-002)", () => {
  it("says so in one line, in the live region, before the year that is told", () => {
    const life = withEvents([{ id: "e", textKey: "event.midlife.looking_back", effects: [] }]);
    render(<LifeScreen {...lifeScreenProps(country, { life, quietRun: { from: 12, to: 15 } })} />);
    const status = screen.getByRole("status");
    expect(within(status).getByText("Years 12 to 15 pass quietly.")).toBeInTheDocument();
    expect(within(status).getByText("You turn 12.")).toBeInTheDocument();
    expect(within(status).getByText(/telling a story you have never told/)).toBeInTheDocument();
  });

  it("names the year when only one passed", () => {
    render(<LifeScreen {...lifeScreenProps(country, { life: withEvents([]), quietRun: { from: 7, to: 7 } })} />);
    expect(screen.getByText("The year you turn 7 passes quietly.")).toBeInTheDocument();
  });

  it("says nothing about quiet years after a single year", () => {
    render(<LifeScreen {...lifeScreenProps(country, { life: withEvents([]), quietRun: null })} />);
    expect(screen.queryByText(/pass(es)? quietly/)).not.toBeInTheDocument();
  });

  it("shows the real run: the years the engine skipped, then the last year's events", async () => {
    // Seed 0 lives two years on its sixth Continue: one passes quietly, the other is told.
    const store = createGameStore(() => "seed-0", testWorld(country));
    await store.begin();
    store.startLife();
    let guard = 0;
    while (!store.getSnapshot().quietRun && guard++ < 30) store.continueYear();
    const { life, quietRun } = store.getSnapshot();
    expect(quietRun).not.toBeNull();
    expect(quietRun!.to).toBe(life!.history.at(-2)!.age);
    render(<App store={store} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/pass(es)? quietly\./);
    expect(status).toHaveTextContent(`You turn ${life!.history.at(-1)!.age}.`);
  });

  it("is not shown when the player skips nothing", async () => {
    const store = createGameStore(() => "seed-0", testWorld(country));
    store.setSettings({ pace: "every-year" });
    await store.begin();
    store.startLife();
    for (let i = 0; i < 12 && !store.getSnapshot().card && store.getSnapshot().life?.person.alive; i++) {
      store.continueYear();
      expect(store.getSnapshot().quietRun).toBeNull();
    }
  });
});

describe("what the player chose, in the story (DEC-001)", () => {
  it("tells the choice and what came of it, with the names the event used", () => {
    const life = withEvents([
      {
        id: "youth.lend_money",
        textKey: "event.childhood.bully",
        decision: {
          choiceId: "stand_up",
          choiceTextKey: "choice.childhood.bully.stand_up",
          outcomeTextKey: "outcome.youth.lend_money.repaid",
        },
        vars: { friend: "Kofi" },
        effects: [],
      },
    ]);
    render(<LifeScreen {...lifeScreenProps(country, { life })} />);
    const item = within(screen.getByRole("status")).getByRole("listitem");
    expect(item).toHaveTextContent("You chose: Stand up to them");
    expect(item).toHaveTextContent("Kofi pays you back, late and with more thanks than you needed.");
  });
});

describe("data notes (EVENT-005)", () => {
  const sources = testSources;
  const note = (textKey: string, value: number) => ({ textKey, value, source: "test", year: 2023 });

  it("formats a share as a percentage, with its source and year", () => {
    expect(dataNoteLine(note("note.child_labour", 0.1), sources)).toBe(
      "Here, about 10% of children between 5 and 17 are in child labour (Synthetic test data, 2023)",
    );
  });

  it("formats a plain number with one decimal where it needs one", () => {
    expect(dataNoteLine(note("note.tfr", 2.4), sources)).toContain("about 2.4 children");
    expect(dataNoteLine(note("note.marriage_age", 25.31), sources)).toContain("at about 25.3 on average");
    expect(dataNoteLine(note("note.marriage_age", 25), sources)).toContain("at about 25 on average");
  });

  it("offers 'one in' for strings that use it", () => {
    const translate = createTranslator({ ...en, "note.test": "About 1 in {oneIn} (a share of {share})" });
    expect(dataNoteLine(note("note.test", 0.125), sources, translate)).toContain("About 1 in 8 (a share of 13%)");
    expect(dataNoteLine(note("note.test", 0), sources, translate)).toContain("About 1 in 0");
  });

  it("falls back to the source id when the source is not listed", () => {
    expect(dataNoteLine({ ...note("note.tfr", 2), source: "other" }, sources)).toContain("(other, 2023)");
  });

  it("shows the formatted note under the event on the life screen", () => {
    const life = withEvents([
      { id: "e", textKey: "event.midlife.looking_back", dataNote: note("note.tfr", 2.4), effects: [] },
    ]);
    render(<LifeScreen {...lifeScreenProps(country, { life })} />);
    expect(
      screen.getByText(/women have about 2\.4 children over a lifetime \(Synthetic test data, 2023\)/),
    ).toBeInTheDocument();
  });
});
