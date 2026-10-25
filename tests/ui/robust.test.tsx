// @vitest-environment jsdom
// A life saved by one version of the game may name text, keys and variables another version lacks. Showing it must
// never blank the app.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Moment } from "../../src/engine/summary";
import type { EventRecord } from "../../src/engine/types";
import { App } from "../../src/ui/App";
import { EventLine } from "../../src/ui/EventLine";
import { ScreenBoundary } from "../../src/ui/ScreenBoundary";
import { SummaryScreen, type SummaryScreenProps } from "../../src/ui/SummaryScreen";
import { createGameStore } from "../../src/ui/store";
import { makeCountry, testSources, testWorld } from "../fixtures/country";
import { fakePersistence, finishedLife } from "./fakes";

const country = makeCountry({ region: "Western Africa" });
const { summary: base } = finishedLife("robust-seed", country);

const props = (summary = base, lastYear: EventRecord[] = []): SummaryScreenProps => ({
  view: { summary, lastYear, archived: true },
  sources: testSources,
  problem: null,
  onEpitaph: vi.fn(),
  onAnother: vi.fn(),
  onPast: vi.fn(),
  onBack: vi.fn(),
});

const event = (changes: Partial<EventRecord> = {}): EventRecord => ({
  id: "x",
  textKey: "event.midlife.looking_back",
  effects: [],
  ...changes,
});

describe("a stored life that names text this version does not have", () => {
  it("leaves an event out of the year's list instead of throwing", () => {
    render(
      <ul>
        <EventLine event={event({ textKey: "event.gone.forever" })} sources={testSources} />
        <EventLine event={event({ textKey: "event.family.relative_died" })} sources={testSources} />
        <EventLine event={event()} sources={testSources} />
      </ul>,
    );
    // The second needs a {name} it was not given, which is as missing as a key.
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(/telling a story you have never told/)).toBeInTheDocument();
  });

  it("leaves out a decision line whose words are gone, but keeps the event, and a help note for a topic it lacks", () => {
    render(
      <ul>
        <EventLine
          event={event({
            decision: { choiceId: "c", choiceTextKey: "choice.gone", outcomeTextKey: "life.quietYear" },
            helpTopic: "gone" as never,
          })}
          sources={testSources}
        />
      </ul>,
    );
    expect(screen.getByText(/telling a story/)).toBeInTheDocument();
    expect(screen.queryByText(/You chose/)).not.toBeInTheDocument();
    expect(screen.queryByText("A quiet year.")).not.toBeInTheDocument();
  });

  it("leaves out a data note whose text is gone", () => {
    render(
      <ul>
        <EventLine
          event={event({ dataNote: { textKey: "note.gone", value: 0.1, source: "test", year: 2023 } })}
          sources={testSources}
        />
      </ul>,
    );
    expect(screen.getByText(/telling a story/)).toBeInTheDocument();
    expect(screen.queryByText(/Synthetic test data/)).not.toBeInTheDocument();
  });

  it("falls back to a neutral passage and leaves out a coda that is gone", () => {
    const death = { ...base.death, passageKey: "death.passage.gone", codaKey: "death.coda.gone" };
    render(<SummaryScreen {...props({ ...base, death })} />);
    expect(screen.getByText(/Something not easily named ends your life/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("says a cause it has no words for as 'a cause not listed here'", () => {
    render(<SummaryScreen {...props({ ...base, death: { ...base.death, age: 51, cause: "newCause" } })} />);
    expect(screen.getByText("Died at 51, of a cause not listed here.")).toBeInTheDocument();
  });

  it("leaves out a condition or sector it has no words for", () => {
    const facts = {
      ...base.facts,
      yearsWorked: 10,
      sector: "moon" as never,
      conditions: ["malaria", "gone_condition"],
    };
    render(<SummaryScreen {...props({ ...base, death: { ...base.death, age: 60 }, facts })} />);
    expect(screen.getByText("You lived with malaria.")).toBeInTheDocument();
    expect(screen.getByText("You spent 10 years in paid work.")).toBeInTheDocument();
  });

  describe("a key moment whose text is gone", () => {
    const moment = (age: number, textKey: string): Moment => ({ age, eventId: `m${age}`, textKey, theme: "plain" });
    const summary = () => {
      const moments = [
        moment(3, "event.midlife.looking_back"),
        moment(5, "event.gone.forever"),
        moment(8, "event.midlife.looking_back"),
      ];
      const rings = base.rings.map((ring) => {
        const copy = { ...ring };
        delete copy.moment;
        const index = moments.findIndex((m) => m.age === ring.age);
        if (index >= 0) copy.moment = index + 1;
        return copy;
      });
      return { ...base, moments, rings };
    };

    it("is left out of the list, and the numbers on the rings follow the numbers in the list", () => {
      const { container } = render(<SummaryScreen {...props(summary())} />);
      const items = within(container.querySelector("ol")!).getAllByRole("listitem");
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent("At 3:");
      expect(items[1]).toHaveTextContent("At 8:");
      const marks = [...container.querySelectorAll("[data-mark]")].map((mark) => mark.textContent);
      expect(marks).toEqual(["1", "2"]);
      // The ring of age 8 carries the number 2 in the table, as the second item says.
      const table = container.querySelector("table")!;
      const rows = [...table.querySelectorAll("tbody tr")].map((row) =>
        [...row.querySelectorAll("td")].map((c) => c.textContent),
      );
      expect(rows.find((row) => row[0] === "8")![3]).toBe("Moment 2");
      expect(rows.find((row) => row[0] === "5")![3]).toBe("");
    });

    it("leaves no list at all when every moment is gone", () => {
      const only = { ...summary(), moments: [moment(5, "event.gone.forever")] };
      const { container } = render(<SummaryScreen {...props(only)} />);
      expect(container.querySelector("ol")).toBeNull();
      expect(screen.queryByRole("heading", { name: "Key moments" })).not.toBeInTheDocument();
    });
  });
});

describe("a screen that cannot be shown", () => {
  const Broken = (): never => {
    throw new Error("cannot show");
  };

  it("says so calmly, with a way back to the start, instead of a blank page", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <ScreenBoundary onBack={onBack}>
        <Broken />
      </ScreenBoundary>,
    );
    const heading = screen.getByRole("heading", { level: 1, name: "Something went wrong" });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/could not be shown\. Your saved lives have not been changed\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to start" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("shows its children when nothing is wrong", () => {
    render(
      <ScreenBoundary onBack={vi.fn()}>
        <p>All well</p>
      </ScreenBoundary>,
    );
    expect(screen.getByText("All well")).toBeInTheDocument();
  });

  it("guards the summary in the app, and the start screen works again after going back", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { past } = finishedLife("boom-1", country);
    const fake = fakePersistence({ status: "none" }, [past]);
    const store = createGameStore(() => "s", testWorld(country), fake.persistence);
    render(<App store={store} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    const open = await screen.findByRole("button", { name: /^Open the life of/ });
    // The stored summary turns out to be one the screen cannot read at all: no death record.
    fake.lives.set("boom-1", { ...past, summary: { ...past.summary, death: undefined as never } });
    await user.click(open);
    expect(await screen.findByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to start" }));
    expect(screen.getByRole("button", { name: "Begin a life" })).toBeInTheDocument();
    spy.mockRestore();
  });
});
