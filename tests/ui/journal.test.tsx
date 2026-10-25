// @vitest-environment jsdom
// Reflection prompts and the journal on the life screen (UI-007, UI-004): the pause after a year, the Notes tab and
// the Journal button, and the stats that moved, said to a screen reader (A11Y-002). Everything here is SYNTHETIC.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "../../src/content/strings/en";
import type { JournalEntry, LifeState, Person } from "../../src/engine/types";
import { hasString } from "../../src/i18n";
import { App } from "../../src/ui/App";
import { LifeScreen, type LifeScreenProps } from "../../src/ui/LifeScreen";
import { createGameStore, JOURNAL_MAX_LENGTH, type ReflectionView, type StatChange } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { makePerson } from "../fixtures/person";
import { deadlyCountry } from "./fakes";
import { backToStart, lifeOf, lifeScreenProps } from "./helpers";

const country = makeCountry({ region: "Western Africa" });

const PROMPT = en["reflection.school.start"]!;

/** Makes the window narrow (or not) for the screen, which asks the browser through matchMedia. */
function windowIsNarrow(narrow: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: narrow,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

afterEach(() => {
  // @ts-expect-error jsdom has no matchMedia of its own; remove what a test added.
  delete window.matchMedia;
});
const LATER = en["reflection.stage.adolescence"]!;

/** A life at `age` with that year told, and the journal given. */
function lifeAt(age: number, journal?: JournalEntry[]): LifeState {
  const person: Person = makePerson({ age, stage: "childhood" });
  return lifeOf(person, {
    history: [{ age, stage: "childhood", stageChanged: false, stats: person.stats, events: [] }],
    ...(journal ? { journal } : {}),
  });
}

const prompt = (age: number, more: Partial<ReflectionView> = {}): ReflectionView => ({
  id: "school.start",
  textKey: "reflection.school.start",
  age,
  ...more,
});

function renderLife(overrides: Partial<LifeScreenProps> = {}) {
  const props = lifeScreenProps(country, { life: lifeAt(7), ...overrides });
  const view = render(<LifeScreen {...props} />);
  return { ...view, props, user: userEvent.setup() };
}

const pause = () => screen.getByRole("region", { name: "A pause" });
const promptField = () => within(pause()).getByRole("textbox", { name: PROMPT });

describe("the reflection prompt after a year (UI-007)", () => {
  it("is shown when the year has one: the prompt labels a single-line field, with the characters left and Save", () => {
    renderLife({ reflection: prompt(7) });
    const field = promptField();
    expect(field.tagName).toBe("INPUT");
    expect(field).toHaveAttribute("maxlength", String(JOURNAL_MAX_LENGTH));
    expect(field).toHaveAccessibleDescription(`${JOURNAL_MAX_LENGTH} characters left`);
    expect(field).not.toBeRequired();
    expect(within(pause()).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(within(pause()).getByText(PROMPT).tagName).toBe("LABEL");
  });

  it("sits outside the one live region, so typing and saving are not read as the story", () => {
    renderLife({ reflection: prompt(7) });
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(within(screen.getByRole("status")).queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it("is not shown when there is none, nor while a decision waits", () => {
    const { rerender, props } = renderLife({ reflection: null });
    expect(screen.queryByRole("region", { name: "A pause" })).not.toBeInTheDocument();
    rerender(
      <LifeScreen
        {...props}
        reflection={null}
        card={{
          eventId: "c",
          textKey: "event.edu.leave_school_for_work.pressure",
          vars: {},
          choices: [{ id: "stay", textKey: "choice.edu.leave.stay", lens: [] }],
        }}
      />,
    );
    expect(screen.queryByRole("region", { name: "A pause" })).not.toBeInTheDocument();
  });

  it("never holds the year up: Continue works with the field empty", async () => {
    const { props, user } = renderLife({ reflection: prompt(7) });
    const next = screen.getByRole("button", { name: "Continue to the next year" });
    expect(next).not.toHaveAttribute("aria-disabled");
    await user.click(next);
    expect(props.onContinue).toHaveBeenCalledTimes(1);
  });

  it("saves the line for the prompt with the button or Enter, says so politely and keeps focus where it was", async () => {
    const { props, user } = renderLife({ reflection: prompt(7) });
    await user.type(promptField(), "Friends, I hope.");
    await user.click(within(pause()).getByRole("button", { name: "Save" }));
    expect(props.onJournal).toHaveBeenCalledWith("Friends, I hope.", "school.start");
    const said = within(pause()).getByText("Your line is saved.");
    expect(said.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(within(pause()).getByRole("button", { name: "Save" })).toHaveFocus();

    // Saved, the field shows the line as the store keeps it (here the spy keeps nothing), and Enter saves too.
    await user.type(promptField(), "A teacher.{Enter}");
    expect(props.onJournal).toHaveBeenLastCalledWith("A teacher.", "school.start");
    expect(promptField()).toHaveFocus();
  });

  it("has its live paragraph on the page before anything is said", () => {
    renderLife({ reflection: prompt(7) });
    const live = within(pause()).getByText(
      (_, element) => element?.getAttribute("aria-live") === "polite" && element.tagName === "P",
    );
    expect(live).toBeEmptyDOMElement();
  });

  it("saves nothing when nothing is written, and says so without asking for anything", async () => {
    const { props, user } = renderLife({ reflection: prompt(7) });
    await user.click(within(pause()).getByRole("button", { name: "Save" }));
    expect(props.onJournal).not.toHaveBeenCalled();
    expect(within(pause()).getByText("There is nothing to save.")).toBeInTheDocument();
  });

  it("opens with what was written, and removes the line when it is saved empty", async () => {
    const { props, user } = renderLife({ reflection: prompt(7, { written: "Friends." }) });
    expect(promptField()).toHaveValue("Friends.");
    await user.clear(promptField());
    await user.keyboard("{Enter}");
    expect(props.onJournal).toHaveBeenCalledWith("", "school.start");
    expect(within(pause()).getByText("Your line was removed.")).toBeInTheDocument();
  });

  it("shows the line as kept once the store has it", async () => {
    /** What the store does: keep the line, tidied, and give it back as `written`. */
    function Harness() {
      const [written, setWritten] = useState<string | undefined>(undefined);
      const props = lifeScreenProps(country, {
        life: lifeAt(7),
        reflection: prompt(7, written ? { written } : {}),
        onJournal: (text) => setWritten(text.replace(/\s+/g, " ").trim() || undefined),
      });
      return <LifeScreen {...props} />;
    }
    render(<Harness />);
    const user = userEvent.setup();
    await user.type(promptField(), "  Friends,   I hope. {Enter}");
    expect(promptField()).toHaveValue("Friends, I hope.");
  });

  it("keeps a line not yet saved while the year is on screen, saves it on Continue, and starts empty the next year", async () => {
    const { props, rerender, user } = renderLife({ reflection: prompt(7) });
    await user.type(promptField(), "Half a thought");
    // The same year again, as when the store sends a new snapshot (a setting changed, the plan moved).
    rerender(<LifeScreen {...props} life={{ ...props.life }} reflection={prompt(7)} />);
    expect(promptField()).toHaveValue("Half a thought");
    // Continue keeps what was written before the year moves on.
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(props.onJournal).toHaveBeenCalledWith("Half a thought", "school.start");
    const saved = vi.mocked(props.onJournal).mock.invocationCallOrder[0]!;
    expect(saved).toBeLessThan(vi.mocked(props.onContinue).mock.invocationCallOrder[0]!);
    // The next year, with a prompt of its own.
    rerender(
      <LifeScreen
        {...props}
        life={lifeAt(8)}
        reflection={{ id: "stage.adolescence", textKey: "reflection.stage.adolescence", age: 8 }}
      />,
    );
    expect(within(pause()).getByRole("textbox", { name: LATER })).toHaveValue("");
    expect(within(pause()).queryByText(/saved/)).not.toBeInTheDocument();
  });

  it("saves both lines being written on Continue, the prompt's with its id and the player's own without, and not an empty one", async () => {
    const { props, user } = renderLife({ reflection: prompt(7, { written: "Kept." }) });
    await user.clear(promptField());
    await user.click(screen.getByRole("tab", { name: "Notes" }));
    await user.type(screen.getByRole("textbox", { name: "A line for this year" }), "Mine.");
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(vi.mocked(props.onJournal).mock.calls).toEqual([["Mine."]]);
    expect(props.onContinue).toHaveBeenCalledTimes(1);
  });

  it("saves a line being written before going back to the start", async () => {
    const { props, user } = renderLife({ reflection: prompt(7) });
    await user.type(promptField(), "Before I go");
    await backToStart(user);
    expect(props.onJournal).toHaveBeenCalledWith("Before I go", "school.start");
    const saved = vi.mocked(props.onJournal).mock.invocationCallOrder[0]!;
    expect(saved).toBeLessThan(vi.mocked(props.onBack).mock.invocationCallOrder[0]!);
  });

  it("keeps a line written in the year the person dies: it is saved before the year is lived, and is in the notes", async () => {
    const store = createGameStore(() => "seed-0", testWorld(deadlyCountry()));
    await store.begin();
    store.startLife();
    render(<App store={store} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Notes" }));
    await user.type(screen.getByRole("textbox", { name: "A line for this year" }), "Not yet saved.");
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(store.getSnapshot().screen).toBe("summary");
    expect(store.getSnapshot().summary!.summary.journal).toEqual([{ age: 0, text: "Not yet saved." }]);
    expect(screen.getByRole("region", { name: "Your notes" })).toHaveTextContent("Not yet saved.");
  });

  it("says nothing new when a change at the limit leaves the length at the limit", async () => {
    const { user } = renderLife({ reflection: prompt(7) });
    const live = within(pause()).getByText(
      (_, element) => element?.getAttribute("aria-live") === "polite" && element.tagName === "P",
    );
    await user.type(promptField(), "x".repeat(JOURNAL_MAX_LENGTH));
    expect(live).toHaveTextContent("No characters left");
    const said = live.firstElementChild;
    // One character replaced: still at the limit, so the words and their node stay as they were.
    await user.type(promptField(), "y", { initialSelectionStart: 0, initialSelectionEnd: 1 });
    expect(promptField()).toHaveValue("y" + "x".repeat(JOURNAL_MAX_LENGTH - 1));
    expect(live.firstElementChild).toBe(said);
  });

  it("is a real pause in a real life: the store's prompt, written and saved through the store", async () => {
    const store = createGameStore(() => "seed-0", testWorld(country));
    await store.begin();
    store.startLife();
    for (let i = 0; i < 40 && !store.getSnapshot().reflection; i++) {
      if (store.getSnapshot().card) store.choose(store.getSnapshot().card!.choices[0]!.id);
      else store.continueYear();
    }
    const { reflection } = store.getSnapshot();
    expect(reflection).not.toBeNull();
    render(<App store={store} />);
    const user = userEvent.setup();
    const field = within(pause()).getByRole("textbox", { name: en[reflection!.textKey]! });
    await user.type(field, "A line.{Enter}");
    expect(store.getSnapshot().life!.journal).toEqual([
      { age: reflection!.age, prompt: reflection!.id, text: "A line." },
    ]);
    expect(store.getSnapshot().reflection!.written).toBe("A line.");
    expect(within(pause()).getByRole("textbox", { name: en[reflection!.textKey]! })).toHaveValue("A line.");
  });
});

describe("the Notes tab (UI-004, UI-007)", () => {
  const notes = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("tab", { name: "Notes" }));
    return within(screen.getByRole("tabpanel", { name: "Notes" }));
  };

  it("has a field for a line of the player's own this year, saved with no prompt", async () => {
    const { props, user } = renderLife();
    const panel = await notes(user);
    const field = panel.getByRole("textbox", { name: "A line for this year" });
    expect(field).toHaveAttribute("maxlength", String(JOURNAL_MAX_LENGTH));
    expect(field).toHaveAccessibleDescription(`${JOURNAL_MAX_LENGTH} characters left`);
    await user.type(field, "A good year.{Enter}");
    expect(props.onJournal).toHaveBeenCalledWith("A good year.");
    expect(panel.getByText("Your line is saved.")).toBeInTheDocument();
  });

  it("opens the field with this year's own line, not a line that answered a prompt", async () => {
    const { user } = renderLife({
      life: lifeAt(7, [
        { age: 7, text: "Mine." },
        { age: 7, prompt: "school.start", text: "Answered." },
      ]),
    });
    const panel = await notes(user);
    expect(panel.getByRole("textbox", { name: "A line for this year" })).toHaveValue("Mine.");
  });

  it("says plainly when nothing is written yet", async () => {
    const { user } = renderLife();
    expect((await notes(user)).getByText("Nothing written yet.")).toBeInTheDocument();
  });

  it("shows the latest three lines, newest first, with the age and the prompt they answered", async () => {
    const { user } = renderLife({
      life: lifeAt(9, [
        { age: 2, text: "First." },
        { age: 6, prompt: "school.start", text: "School." },
        { age: 7, text: "Seven." },
        { age: 8, prompt: "no.such.prompt", text: "Eight." },
      ]),
    });
    const panel = await notes(user);
    const items = within(panel.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(/^At 8\s*Eight\.$/);
    expect(items[1]).toHaveTextContent(/^At 7\s*Seven\.$/);
    expect(items[2]).toHaveTextContent("At 6");
    expect(items[2]).toHaveTextContent(PROMPT);
    expect(items[2]).toHaveTextContent("School.");
    // The full line stays reachable by pointer as well as in the dialog.
    expect(within(items[2]!).getByText("School.")).toHaveAttribute("title", "School.");
  });

  it("opens the whole journal in a dialog, newest first, and Escape gives focus back to the button", async () => {
    const journal: JournalEntry[] = [1, 2, 3, 4, 5].map((age) => ({ age, text: `Line at ${age}.` }));
    const { user } = renderLife({ life: lifeAt(6, journal) });
    const panel = await notes(user);
    const all = panel.getByRole("button", { name: "All 5 lines" });
    await user.click(all);
    const dialog = within(screen.getByRole("dialog", { name: "Your journal" }));
    expect(dialog.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "At 5Line at 5.",
      "At 4Line at 4.",
      "At 3Line at 3.",
      "At 2Line at 2.",
      "At 1Line at 1.",
    ]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(all).toHaveFocus());
  });

  it("offers the journal in full even with one line, so a line cut short on screen can always be read", async () => {
    const { user } = renderLife({ life: lifeAt(6, [{ age: 5, text: "Only one." }]) });
    const panel = await notes(user);
    await user.click(panel.getByRole("button", { name: "Read the line in full" }));
    expect(within(screen.getByRole("dialog", { name: "Your journal" })).getByText("Only one.")).toBeInTheDocument();
  });

  it("shows the lines whole in the narrow layout, where the column is the page's width", async () => {
    windowIsNarrow(true);
    const { user } = renderLife({ life: lifeAt(9, [{ age: 6, prompt: "school.start", text: "School." }]) });
    await user.click(screen.getByRole("tab", { name: "Around you" }));
    const panel = await notes(user);
    expect(within(panel.getByRole("list")).getByText("School.")).not.toHaveAttribute("title");
    expect(within(panel.getByRole("list")).getByText(PROMPT)).not.toHaveAttribute("title");
  });

  it("keeps a line not yet saved when the player looks at another tab and comes back", async () => {
    const { user } = renderLife();
    await user.type((await notes(user)).getByRole("textbox", { name: "A line for this year" }), "Not done");
    await user.click(screen.getByRole("tab", { name: "Family" }));
    expect((await notes(user)).getByRole("textbox", { name: "A line for this year" })).toHaveValue("Not done");
  });

  it("is where the Journal button sends focus: the field, each time it is pressed", async () => {
    const { user } = renderLife();
    await user.click(screen.getByRole("button", { name: "Journal" }));
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "A line for this year" })).toHaveFocus();
    await user.click(screen.getByRole("tab", { name: "Family" }));
    await user.click(screen.getByRole("button", { name: "Journal" }));
    expect(screen.getByRole("textbox", { name: "A line for this year" })).toHaveFocus();
    // From the keyboard too.
    await user.click(screen.getByRole("tab", { name: "Country" }));
    screen.getByRole("button", { name: "Journal" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "A line for this year" })).toHaveFocus();
  });
});

describe("the one live region of the life screen (A11Y-002)", () => {
  /** Every year the same: twelve, quiet. */
  const sameYears = (count: number) => {
    const person = makePerson({ age: 12 });
    const record = { age: 12, stage: "childhood" as const, stageChanged: false, stats: person.stats, events: [] };
    return lifeOf(person, { history: Array.from({ length: count }, () => record) });
  };

  it("is on the page from the first render, before there is anything to say, and out of sight", () => {
    renderLife({ life: lifeOf(makePerson({ age: 0 })) });
    const status = screen.getByRole("status");
    expect(status).toHaveClass("visually-hidden");
    expect(status).not.toHaveTextContent(/\S/);
  });

  it("is outside the tabs on a phone, so it still speaks while You or Around you is shown", async () => {
    windowIsNarrow(true);
    const { user } = renderLife();
    await user.click(screen.getByRole("tab", { name: "You" }));
    const status = screen.getByRole("status");
    expect(status.closest("[inert]")).toBeNull();
    expect(status.closest("[role=tabpanel]")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("says the year again as new nodes when its words are the same as the year before", () => {
    const { props, rerender } = renderLife({ life: sameYears(1) });
    const status = screen.getByRole("status");
    const first = within(status).getByText("You turn 12.");
    rerender(<LifeScreen {...props} life={sameYears(2)} />);
    expect(screen.getByRole("status")).toBe(status);
    const second = within(status).getByText("You turn 12.");
    expect(second).not.toBe(first);
  });

  it("carries the year: the quiet run, the year's line, the events in words and the stats; the story itself is not live", () => {
    const person = makePerson({ age: 12 });
    const life = lifeOf(person, {
      history: [
        {
          age: 12,
          stage: "childhood",
          stageChanged: false,
          stats: person.stats,
          events: [
            {
              id: "e",
              textKey: "event.childhood.bully",
              vars: { friend: "Kofi" },
              decision: {
                choiceId: "stand_up",
                choiceTextKey: "choice.childhood.bully.stand_up",
                outcomeTextKey: "outcome.youth.lend_money.repaid",
              },
              helpTopic: "grief",
              effects: [],
            },
          ],
        },
      ],
    });
    renderLife({ life, quietRun: { from: 9, to: 11 }, statChanges: [{ stat: "health", delta: 5 }] });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Years 9 to 11 pass quietly.");
    expect(status).toHaveTextContent("You turn 12.");
    expect(status).toHaveTextContent("You chose: Stand up to them.");
    expect(status).toHaveTextContent("Kofi pays you back");
    expect(status).toHaveTextContent(en["help.grief"]!);
    expect(status).toHaveTextContent(en["help.link"]!);
    expect(status).toHaveTextContent("Health rose by 5.");
    // The visible story says the same, once, and is not a live region of its own.
    const story = screen.getByRole("heading", { level: 2, name: "This year" }).parentElement!;
    expect(story.closest("[aria-live], [role=status]")).toBeNull();
  });
});

describe("the stats that moved, said to a screen reader (A11Y-002)", () => {
  const changes: StatChange[] = [
    { stat: "health", delta: 4 },
    { stat: "happiness", delta: -3 },
    { stat: "belonging", delta: 12 },
  ];

  it("are told in the live region, in words and out of sight, and nowhere else", () => {
    renderLife({ statChanges: changes });
    const status = screen.getByRole("status");
    const line = within(status).getByText("Health rose by 4. Happiness fell by 3. Belonging rose by 12.");
    expect(line.tagName).toBe("P");
    expect(status).toHaveClass("visually-hidden");
    expect(screen.getAllByText(/rose by/)).toHaveLength(1);
  });

  it("say nothing when nothing moved by much", () => {
    renderLife({ statChanges: [] });
    expect(within(screen.getByRole("status")).queryByText(/rose by|fell by/)).not.toBeInTheDocument();
  });

  it("follow a real year from the store", async () => {
    const store = createGameStore(() => "seed-0", testWorld(country));
    await store.begin();
    store.startLife();
    for (let i = 0; i < 60 && store.getSnapshot().statChanges.length === 0; i++) {
      if (store.getSnapshot().card) store.choose(store.getSnapshot().card!.choices[0]!.id);
      else store.continueYear();
    }
    const { statChanges } = store.getSnapshot();
    expect(statChanges.length).toBeGreaterThan(0);
    render(<App store={store} />);
    const first = statChanges[0]!;
    const name = en[`life.stat.${first.stat}`]!;
    expect(screen.getByRole("status")).toHaveTextContent(
      `${name} ${first.delta > 0 ? "rose" : "fell"} by ${Math.abs(first.delta)}.`,
    );
  });
});

// Keys built from data are not seen by the guard test, so check here that every one exists.
describe("strings built from data (journal)", () => {
  const keys = [
    ...["one", "other"].flatMap((form) => [
      `journal.left.${form}`,
      `notes.all.${form}`,
      `life.statChange.rose.${form}`,
      `life.statChange.fell.${form}`,
      `family.more.${form}`,
    ]),
    ...["health", "happiness", "belonging", "skills"].map((stat) => `life.stat.${stat}`),
  ];
  it.each(keys)("%s exists", (key) => {
    expect(hasString(key)).toBe(true);
  });

  it("names the Belonging stat Belonging", () => {
    expect(en["life.stat.belonging"]).toBe("Belonging");
  });
});

describe("a line typed while a decision waits (UI-007)", () => {
  it("is kept when the player answers the decision, as it is when they continue", async () => {
    let found = false;
    for (let s = 0; s < 30 && !found; s++) {
      const store = createGameStore(() => `seed-${s}`, testWorld(country));
      await store.begin();
      store.startLife();
      for (let i = 0; i < 60 && store.getSnapshot().life?.person.alive && !store.getSnapshot().card; i++) {
        store.continueYear();
      }
      const waiting = store.getSnapshot();
      if (!waiting.card || !waiting.life?.person.alive) continue;
      found = true;
      const ageBefore = waiting.life.person.age;
      render(<App store={store} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("tab", { name: "Notes" }));
      await user.type(screen.getByRole("textbox", { name: "A line for this year" }), "About the choice.");
      const choices = within(screen.getByRole("list", { name: "Your choices" })).getAllByRole("button");
      await user.click(choices.find((button) => button.getAttribute("aria-disabled") !== "true")!);
      const after = store.getSnapshot();
      expect(after.life?.person.age).toBeGreaterThan(ageBefore);
      expect(after.life?.journal).toContainEqual({ age: ageBefore, text: "About the choice." });
    }
    expect(found).toBe(true);
  });
});
