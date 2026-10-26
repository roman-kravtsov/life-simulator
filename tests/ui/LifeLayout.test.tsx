// @vitest-environment jsdom
// The life screen's layout (UI-004, UI-010): the header with its strip, the two side columns with their tabs, the
// ledger of years and the narrow layout with its tab bar. Everything here is SYNTHETIC.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { hasString } from "../../src/i18n";
import type { DecisionCard } from "../../src/engine/decisions";
import type { EventRecord, Person, Relationship, YearRecord } from "../../src/engine/types";
import { planOverview } from "../../src/ui/store";
import { LifeScreen } from "../../src/ui/LifeScreen";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";
import { lifeOf, lifeScreenProps } from "./helpers";

const country = makeCountry();

const told = (textKey = "event.midlife.looking_back", more: Partial<EventRecord> = {}): EventRecord => ({
  id: textKey,
  textKey,
  effects: [],
  ...more,
});

const year = (person: Person, age: number, events: EventRecord[] = [], more: Partial<YearRecord> = {}): YearRecord => ({
  age,
  stage: "adolescence",
  stageChanged: false,
  stats: person.stats,
  events,
  ...more,
});

const relative = (overrides: Partial<Relationship>): Relationship => ({
  id: "r",
  kind: "sibling",
  name: "Test",
  sex: "female",
  age: 10,
  alive: true,
  closeness: 50,
  ...overrides,
});

/** A decision waiting, as the store reports it. */
const card: DecisionCard = {
  eventId: "test.card",
  textKey: "event.edu.leave_school_for_work.pressure",
  vars: {},
  choices: [
    { id: "stay", textKey: "choice.edu.leave.stay", lens: [] },
    { id: "leave", textKey: "choice.edu.leave.leave", lens: [] },
  ],
};

function renderLife(
  overrides: Partial<Person> = {},
  props: Parameters<typeof lifeScreenProps>[1] = {},
  history: (person: Person) => YearRecord[] = () => [],
) {
  const person = makePerson({ name: "Lucas Almeida", age: 16, stage: "adolescence", ...overrides });
  const all = lifeScreenProps(country, { life: lifeOf(person, { history: history(person) }), ...props });
  return { ...render(<LifeScreen {...all} />), props: all, user: userEvent.setup() };
}

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

describe("the header (UI-004, UI-012)", () => {
  it("has the wordmark, who you are and where, and the actions", () => {
    renderLife();
    const header = within(screen.getByRole("banner"));
    expect(header.getByText("Birthright")).toBeInTheDocument();
    expect(header.getByText("Lucas Almeida")).toBeInTheDocument();
    expect(header.getByText(/^Age 16 · Testland, town or city$/)).toBeInTheDocument();
    expect(header.getByRole("button", { name: "Journal" })).toBeInTheDocument();
    expect(header.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(header.getByRole("link", { name: "Need to talk?" })).toHaveAttribute("href", "https://findahelpline.com");
    expect(header.getByRole("button", { name: "Continue to the next year" })).toHaveTextContent("Continue");
  });

  it("keeps Continue working when no decision waits", async () => {
    const { props, user } = renderLife();
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(props.onContinue).toHaveBeenCalledTimes(1);
  });

  it("shows Continue but does not take it while a decision waits, and says why", async () => {
    const { props, user } = renderLife({}, { card });
    const next = screen.getByRole("button", { name: "Continue to the next year" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveAccessibleDescription("Answer the decision first.");
    // It can still be reached and pressed, and pressing does nothing.
    await user.tab();
    while (document.activeElement !== next) await user.tab();
    await user.keyboard("{Enter}");
    await user.click(next);
    expect(props.onContinue).not.toHaveBeenCalled();
  });

  it("has no reason attached when the year can go on", () => {
    renderLife();
    const next = screen.getByRole("button", { name: "Continue to the next year" });
    expect(next).not.toHaveAttribute("aria-disabled");
    expect(next).not.toHaveAccessibleDescription();
  });

  it("opens the settings in a dialog: the two choices, how it looks, and the way back to the start", async () => {
    const { props, user } = renderLife();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = within(screen.getByRole("dialog", { name: "Settings" }));
    await user.click(dialog.getByRole("switch", { name: "Softer telling" }));
    expect(props.onSettings).toHaveBeenCalledWith({ softening: true });
    expect(dialog.getByRole("switch", { name: "Skip quiet years" })).toBeChecked();
    const looks = within(dialog.getByRole("region", { name: "How it looks" }));
    expect(looks.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(looks.getByRole("radiogroup", { name: "Text size" })).toBeInTheDocument();
    expect(looks.getByRole("switch", { name: "Reduce motion" })).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Switch light or dark" })).not.toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Back to start" }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it("closes the settings with Escape and returns to the button", async () => {
    const { user } = renderLife();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Settings" })).toHaveFocus());
  });
});

describe("the life strip (UI-004)", () => {
  it("is a picture that says the age and that the dots mark key events", () => {
    renderLife({ age: 16 });
    const strip = screen.getByRole("img", {
      name: /^Your life so far: you are 16 of about 80\. Dots mark key events\.$/,
    });
    expect(strip).toBeInTheDocument();
    const header = within(screen.getByRole("banner"));
    expect(header.getByText("Birth")).toBeInTheDocument();
    expect(header.getByText("about 80")).toBeInTheDocument();
  });

  it("ends five years past someone older than 75", () => {
    renderLife({ age: 80, stage: "elder" });
    expect(screen.getByRole("img", { name: /of about 85\./ })).toBeInTheDocument();
    expect(within(screen.getByRole("banner")).getByText("about 85")).toBeInTheDocument();
  });

  it("has a dot for each key moment, and a marker for now", () => {
    const { container } = renderLife({ age: 8 }, {}, (person) => [
      year(person, 3),
      year(person, 5, [told()]),
      year(person, 8, [told()]),
    ]);
    const strip = container.querySelector("[role='img'][aria-label^='Your life so far']")!;
    expect(strip.querySelectorAll("[data-moment]")).toHaveLength(2);
    expect(strip.querySelectorAll("[data-now]")).toHaveLength(1);
  });

  it("is left out in the narrow layout", () => {
    windowIsNarrow(true);
    renderLife();
    expect(screen.queryByRole("img", { name: /^Your life so far/ })).not.toBeInTheDocument();
  });
});

describe("the column about you (UI-004)", () => {
  it("is a labelled landmark with the rings, the four stats and the tabs", () => {
    renderLife({ age: 3, stage: "infancy", stats: { health: 71, happiness: 58, belonging: 64, skills: 47 } });
    const aside = within(screen.getByRole("complementary", { name: "About you" }));
    expect(aside.getByRole("heading", { level: 2, name: "You" })).toBeInTheDocument();
    expect(aside.getByText("No rings yet")).toBeInTheDocument();
    expect(aside.getByRole("tablist", { name: "Your situation" })).toBeInTheDocument();
    expect(aside.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["School & work", "Money", "Health"]);
  });

  it("counts the rings: one a year", () => {
    renderLife({ age: 2 }, {}, (person) => [year(person, 1), year(person, 2)]);
    expect(screen.getByText("2 years, one ring each")).toBeInTheDocument();
  });

  it("gives each stat as a meter whose name carries the number and a word, with no word beside it", () => {
    renderLife({ stats: { health: 71, happiness: 58, belonging: 64, skills: 47 } });
    expect(screen.getByRole("meter", { name: "Health 71, good" })).toHaveAttribute("value", "71");
    expect(screen.getByRole("meter", { name: "Happiness 58, fair" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Belonging 64, good" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Skills 47, fair" })).toBeInTheDocument();
    // The number and the label are seen, and not read a second time.
    const aside = screen.getByRole("complementary", { name: "About you" });
    expect(within(aside).queryByText("good")).not.toBeInTheDocument();
  });

  it("starts on school and work, and moves between the tabs with the arrow keys", async () => {
    const { user } = renderLife({ age: 30, stage: "adulthood" });
    const aside = within(screen.getByRole("complementary", { name: "About you" }));
    expect(aside.getByRole("tab", { name: "School & work" })).toHaveAttribute("aria-selected", "true");
    expect(aside.getByRole("tabpanel", { name: "School & work" })).toBeInTheDocument();
    aside.getByRole("tab", { name: "School & work" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(aside.getByRole("tab", { name: "Money" })).toHaveFocus();
    expect(aside.getByRole("tabpanel", { name: "Money" })).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(aside.getByRole("tabpanel", { name: "Health" })).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(aside.getByRole("tab", { name: "School & work" })).toHaveFocus();
  });

  it("tells school and work together on the first tab", () => {
    renderLife({
      age: 16,
      education: { level: "lower-secondary", inSchool: true, years: 9, literate: true },
      work: { status: "student", yearsWorked: 0, attachment: 0.5 },
    });
    const panel = within(screen.getByRole("tabpanel", { name: "School & work" }));
    expect(panel.getByText("In upper secondary school.")).toBeInTheDocument();
    expect(panel.getByText("9 years")).toBeInTheDocument();
    expect(panel.getByText("You can read and write.")).toBeInTheDocument();
    expect(panel.getByText("Studying. School is your work for now.")).toBeInTheDocument();
  });

  it("keeps the money, the US prices switch and the sources note on the second", async () => {
    const { props, user } = renderLife({ age: 30, stage: "adulthood" });
    await user.click(screen.getByRole("tab", { name: "Money" }));
    const panel = within(screen.getByRole("tabpanel", { name: "Money" }));
    expect(panel.getByText(/international dollars/)).toBeInTheDocument();
    await user.click(panel.getByRole("switch", { name: "Compare with US prices" }));
    expect(props.onToggleUsPrices).toHaveBeenCalledTimes(1);
  });

  it("lists the health conditions on the third, with help beside the ones that have a topic", async () => {
    const { user } = renderLife({
      age: 30,
      stage: "adulthood",
      conditions: [
        { id: "malaria", severity: 1, since: 20 },
        { id: "depression", severity: 2, since: 25 },
      ],
    });
    await user.click(screen.getByRole("tab", { name: "Health" }));
    const panel = within(screen.getByRole("tabpanel", { name: "Health" }));
    expect(panel.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Malaria, mild, since age 20",
      "Depression, moderate, since age 25",
    ]);
    expect(panel.getByRole("link", { name: "findahelpline.com" })).toBeInTheDocument();
  });

  it("says so when there are no conditions", async () => {
    const { user } = renderLife({ age: 30, stage: "adulthood" });
    await user.click(screen.getByRole("tab", { name: "Health" }));
    expect(screen.getByRole("tabpanel", { name: "Health" })).toHaveTextContent("No lasting health conditions.");
  });
});

describe("the column around you (UI-004)", () => {
  const family = [
    relative({ id: "m", kind: "mother", name: "Marta", age: 41, closeness: 72 }),
    relative({ id: "f", kind: "father", name: "Paulo", age: 44, closeness: 55 }),
    relative({ id: "b", name: "Bia", age: 12, closeness: 90 }),
  ];

  it("is a labelled landmark with the family first, then the country and the notes", () => {
    renderLife({ relationships: family });
    const aside = within(screen.getByRole("complementary", { name: "Around you" }));
    expect(aside.getByRole("heading", { level: 2, name: "Around you" })).toBeInTheDocument();
    expect(aside.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Family", "Country", "Notes"]);
    expect(aside.getByRole("tab", { name: "Family" })).toHaveAttribute("aria-selected", "true");
    const panel = within(aside.getByRole("tabpanel", { name: "Family" }));
    expect(panel.getByText("Marta, your mother, 41")).toBeInTheDocument();
    expect(panel.getByText("very close")).toBeInTheDocument();
  });

  it("moves to the country tab by keyboard, with each fact's source and year", async () => {
    const { user } = renderLife({ relationships: family, sex: "female" });
    screen.getByRole("tab", { name: "Family" }).focus();
    await user.keyboard("{ArrowRight}");
    const panel = within(screen.getByRole("tabpanel", { name: "Country" }));
    const facts = panel.getAllByRole("term").map((term) => term.textContent);
    expect(facts).toEqual([
      "Life expectancy at birth, for women",
      "Women who finish upper secondary school",
      "Each person in a middle household, a day (international dollars)",
    ]);
    expect(panel.getByText("50%")).toBeInTheDocument();
    expect(panel.getByText("$25.50")).toBeInTheDocument();
    // Each fact names its source, from the index, and its year.
    expect(panel.getAllByText("Synthetic test data, 2023")).toHaveLength(3);
  });

  it("speaks of men for a man", async () => {
    const { user } = renderLife({ sex: "male" });
    await user.click(screen.getByRole("tab", { name: "Country" }));
    expect(screen.getByText("Men who finish upper secondary school")).toBeInTheDocument();
  });

  it("leaves out a figure that was estimated from a region, rather than call it a fact about the country", async () => {
    const base = makeCountry();
    const estimated = makeCountry({
      education: {
        ...base.education,
        upperSecondaryCompletion: { ...base.education.upperSecondaryCompletion, estimated: true },
      },
    });
    const { user } = renderLife({}, { country: estimated });
    await user.click(screen.getByRole("tab", { name: "Country" }));
    const panel = within(screen.getByRole("tabpanel", { name: "Country" }));
    expect(panel.queryByText(/finish upper secondary school/)).not.toBeInTheDocument();
    expect(panel.getByText(/Life expectancy at birth/)).toBeInTheDocument();
  });

  it("says plainly when nothing in the country data can be shown as measured", async () => {
    const base = makeCountry();
    const all = makeCountry({
      education: {
        ...base.education,
        upperSecondaryCompletion: { ...base.education.upperSecondaryCompletion, estimated: true },
      },
      money: { ...base.money, percentiles: { ...base.money.percentiles, estimated: true } },
      demography: { ...base.demography, lifeTable: { ...base.demography.lifeTable, estimated: true } },
    });
    const { user } = renderLife({}, { country: all });
    await user.click(screen.getByRole("tab", { name: "Country" }));
    expect(screen.getByRole("tabpanel", { name: "Country" })).toHaveTextContent(
      "The game has no measured figures for this country to show here.",
    );
  });

  it("holds the notes: a field for a line of your own this year (UI-007)", async () => {
    const { user } = renderLife();
    await user.click(screen.getByRole("tab", { name: "Notes" }));
    const notes = within(screen.getByRole("tabpanel", { name: "Notes" }));
    expect(notes.getByRole("textbox", { name: "A line for this year" })).toBeInTheDocument();
    expect(notes.getByText("Nothing written yet.")).toBeInTheDocument();
  });

  it("opens the notes from the Journal button and moves focus into their field", async () => {
    const { user } = renderLife();
    await user.click(screen.getByRole("button", { name: "Journal" }));
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");
    const field = () =>
      within(screen.getByRole("tabpanel", { name: "Notes" })).getByRole("textbox", { name: "A line for this year" });
    expect(field()).toHaveFocus();
    // Pressed again with the tab already open, focus still goes back in.
    await user.click(screen.getByRole("tab", { name: "Family" }));
    await user.click(screen.getByRole("button", { name: "Journal" }));
    expect(field()).toHaveFocus();
  });
});

describe("the ledger of years (UI-004)", () => {
  const history = (person: Person) => [
    year(person, 12, [told("event.midlife.looking_back")]),
    year(person, 13, [], { stage: "adolescence", stageChanged: true }),
    year(person, 14),
    year(person, 15, [
      told("event.childhood.bully", {
        vars: { friend: "Kofi" },
        decision: {
          choiceId: "stand_up",
          choiceTextKey: "choice.childhood.bully.stand_up",
          outcomeTextKey: "outcome.youth.lend_money.repaid",
        },
      }),
    ]),
    year(person, 16, [told("event.midlife.looking_back")]),
  ];

  it("puts this year on top: the age, the story and the year's events", () => {
    renderLife({ age: 16 }, {}, history);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Age 16");
    expect(within(screen.getByRole("status")).getByText("You turn 16.")).toBeInTheDocument();
    const story = within(screen.getByRole("heading", { level: 2, name: "This year" }).parentElement!);
    expect(story.getByText("You turn 16.")).toBeInTheDocument();
  });

  it("lists the earlier years below, newest first, one paragraph each, in a list with a name", () => {
    renderLife({ age: 16 }, {}, history);
    const list = screen.getByRole("list", { name: "Earlier years" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => /^Age (\d+)/.exec(item.textContent ?? "")?.[1])).toEqual(["15", "14", "13", "12"]);
    expect(items[0]).toHaveTextContent(/Kofi pays you back, late and with more thanks than you needed\./);
    expect(items[0]).toHaveTextContent("You chose: Stand up to them");
    expect(items[1]).toHaveTextContent("A quiet year.");
    expect(items[2]).toHaveTextContent("A new chapter begins: Adolescence.");
    expect(items[3]).toHaveTextContent(/telling a story you have never told/);
  });

  it("does not repeat this year among the earlier ones", () => {
    renderLife({ age: 16 }, {}, history);
    const list = screen.getByRole("list", { name: "Earlier years" });
    expect(within(list).queryByText("You turn 16.")).not.toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  it("keeps the last year in the ledger while a decision waits, as the page tells the wait and not that year", () => {
    renderLife({ age: 16 }, { card }, history);
    expect(within(screen.getByRole("status")).queryByText("You turn 16.")).not.toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Earlier years" })).getAllByRole("listitem");
    expect(items.map((item) => /^Age (\d+)/.exec(item.textContent ?? "")?.[1])).toEqual(["16", "15", "14", "13", "12"]);
    expect(items[0]).toHaveTextContent(/telling a story you have never told/);
  });

  it("has no list of earlier years before there are any", () => {
    renderLife({ age: 1 }, {}, (person) => [year(person, 1)]);
    expect(screen.queryByRole("list", { name: "Earlier years" })).not.toBeInTheDocument();
  });

  it("keeps help beside an earlier year that was hard", () => {
    renderLife({ age: 16 }, {}, (person) => [
      year(person, 14, [told("event.midlife.looking_back", { helpTopic: "grief", sensitivity: "difficult" })]),
      year(person, 15),
      year(person, 16),
    ]);
    const list = within(screen.getByRole("list", { name: "Earlier years" }));
    expect(list.getByRole("link", { name: "findahelpline.com" })).toBeInTheDocument();
  });

  it("leaves out an earlier event whose words this version no longer has, rather than failing", () => {
    renderLife({ age: 16 }, {}, (person) => [
      year(person, 14, [told("event.that.does.not.exist")]),
      year(person, 15),
      year(person, 16),
    ]);
    const items = within(screen.getByRole("list", { name: "Earlier years" })).getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("A quiet year.");
  });

  it("stays quick for a long life: a hundred earlier years render as a list of a hundred", () => {
    renderLife({ age: 101, stage: "elder" }, {}, (person) =>
      Array.from({ length: 101 }, (_, index) => year(person, index + 1)),
    );
    expect(within(screen.getByRole("list", { name: "Earlier years" })).getAllByRole("listitem")).toHaveLength(100);
  });

  it("keeps exactly one status region on the screen", () => {
    renderLife({ age: 16 }, { plan: null }, history);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

describe("the plan tray (UI-005)", () => {
  const life = lifeOf(makePerson({ age: 10 }));

  it("is a labelled region with the story, and is there when no decision waits", () => {
    render(<LifeScreen {...lifeScreenProps(country, { life, plan: planOverview(life) })} />);
    expect(screen.getByRole("region", { name: "Where your attention goes" })).toBeInTheDocument();
  });

  it("gives way to the decision while one waits", () => {
    render(<LifeScreen {...lifeScreenProps(country, { life, plan: null, card })} />);
    expect(screen.queryByRole("region", { name: "Where your attention goes" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "A decision" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("A decision is waiting.");
  });
});

describe("the narrow layout (UI-010)", () => {
  it("shows a bar of three tabs, Story first, and only the story's column", () => {
    windowIsNarrow(true);
    renderLife({ age: 16 });
    const bar = screen.getByRole("tablist", { name: "Parts of this screen" });
    expect(
      within(bar)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Story", "You", "Around you"]);
    expect(screen.getByRole("tab", { name: "Story" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    // The other two columns are in the page but out of sight and out of the way.
    expect(screen.getByRole("complementary", { name: "About you", hidden: true }).closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("complementary", { name: "Around you", hidden: true }).closest("[inert]")).not.toBeNull();
  });

  it("switches the column with the tab, by keyboard as well", async () => {
    windowIsNarrow(true);
    const { user } = renderLife({ age: 16 });
    screen.getByRole("tab", { name: "Story" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "You" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("complementary", { name: "About you" }).closest("[inert]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, hidden: true }).closest("[inert]")).not.toBeNull();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("complementary", { name: "Around you" }).closest("[inert]")).toBeNull();
    expect(screen.getByRole("complementary", { name: "About you", hidden: true }).closest("[inert]")).not.toBeNull();
  });

  it("keeps the header to the wordmark, Settings, help and Continue", () => {
    windowIsNarrow(true);
    renderLife({ age: 16 });
    const header = within(screen.getByRole("banner"));
    expect(header.getByText("Birthright")).toBeInTheDocument();
    expect(header.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(header.getByRole("link", { name: "Need to talk?" })).toBeInTheDocument();
    expect(header.getByRole("button", { name: "Continue to the next year" })).toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Journal" })).not.toBeInTheDocument();
    expect(header.queryByText("Lucas Almeida")).not.toBeInTheDocument();
  });

  it("shows the person's name on the story instead, since the header has none", () => {
    windowIsNarrow(true);
    renderLife({ age: 16 });
    expect(screen.getByText("Lucas Almeida")).toBeInTheDocument();
  });

  it("comes back to the story when Continue is pressed, so the new year is where focus lands", async () => {
    windowIsNarrow(true);
    const { user } = renderLife({ age: 16 });
    await user.click(screen.getByRole("tab", { name: "You" }));
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(screen.getByRole("tab", { name: "Story" })).toHaveAttribute("aria-selected", "true");
  });

  it("takes the Journal to the Notes tab of the column around you", async () => {
    windowIsNarrow(true);
    const { user } = renderLife({ age: 16 });
    // Journal is a tab's worth of reach in this layout: Around you, then Notes.
    await user.click(screen.getByRole("tab", { name: "Around you" }));
    expect(screen.getByRole("complementary", { name: "Around you" }).closest("[inert]")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Notes" }));
    expect(screen.getByRole("tabpanel", { name: "Notes" })).toBeInTheDocument();
  });

  it("puts the two parts of the settings dialog one level under its title", async () => {
    windowIsNarrow(false);
    const { user } = renderLife({ age: 16 });
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = within(screen.getByRole("dialog", { name: "Settings" }));
    expect(dialog.getByRole("heading", { level: 2, name: "Settings" })).toBeInTheDocument();
    expect(dialog.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "How you want to play",
      "How it looks",
    ]);
  });

  it("has the settings in a dialog too", async () => {
    windowIsNarrow(true);
    const { user } = renderLife({ age: 16 });
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      within(screen.getByRole("dialog", { name: "Settings" })).getByRole("button", { name: "Back to start" }),
    ).toBeInTheDocument();
  });
});

// Keys built from data are not seen by the guard test, so check here that every one exists.
describe("strings built from data (life screen)", () => {
  const keys = [
    ...["very-low", "low", "fair", "good", "very-good"].map((band) => `life.statBand.${band}`),
    ...["female", "male"].flatMap((sex) => [`country.lifeExpectancy.${sex}`, `country.upperSecondary.${sex}`]),
    ...["one", "other"].map((form) => `life.you.rings.${form}`),
  ];
  it.each(keys)("%s exists", (key) => {
    expect(hasString(key)).toBe(true);
  });
});
