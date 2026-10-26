// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { en } from "../../src/content/strings/en";
import type { LifeFacts, LifeSummary, Moment, Shaping } from "../../src/engine/summary";
import type { EventRecord } from "../../src/engine/types";
import { t } from "../../src/i18n";
import { SummaryScreen, type SummaryScreenProps } from "../../src/ui/SummaryScreen";
import { EPITAPH_MAX_LENGTH, type SummaryView } from "../../src/ui/store";
import { makeCountry, testSources } from "../fixtures/country";
import { finishedLife } from "./fakes";

const country = makeCountry({ region: "Western Africa" });
const { summary: base } = finishedLife("summary-seed-1", country);

const view = (changes: Partial<LifeSummary> = {}, lastYear: EventRecord[] = [], archived = false): SummaryView => ({
  summary: { ...base, ...changes },
  lastYear,
  archived,
});

const props = (v: SummaryView, overrides: Partial<SummaryScreenProps> = {}): SummaryScreenProps => ({
  view: v,
  sources: testSources,
  problem: null,
  onEpitaph: vi.fn(),
  onAnother: vi.fn(),
  onPast: vi.fn(),
  onBack: vi.fn(),
  ...overrides,
});

/** A life that ended at `age`, against the given expectancy. */
const ended = (age: number, expectancy: Partial<LifeSummary["death"]["expectancy"]>, sex: "female" | "male" = "male") =>
  view({
    sex,
    death: {
      ...base.death,
      age,
      expectancy: { ...base.death.expectancy, source: "test", year: 2023, ...expectancy },
    },
  });

const event = (changes: Partial<EventRecord> = {}): EventRecord => ({
  id: "test.event",
  textKey: "event.midlife.looking_back",
  effects: [],
  ...changes,
});

describe("SUM-001: the summary screen", () => {
  it("names the person, says where and when, and takes focus", () => {
    render(<SummaryScreen {...props(view())} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(base.name);
    expect(heading).toHaveTextContent(`Testland, ${base.birthYear} to ${base.death.year}`);
    expect(heading).toHaveFocus();
  });

  it("says plainly how old the person was and what they died of, in words (DEATH-001)", () => {
    const { rerender } = render(
      <SummaryScreen {...props(view({ death: { ...base.death, age: 41, cause: "cancer" } }))} />,
    );
    expect(screen.getByText("Died at 41, of cancer.")).toBeInTheDocument();
    rerender(<SummaryScreen {...props(view({ death: { ...base.death, age: 34, cause: "selfHarm" } }))} />);
    expect(screen.getByText("Died at 34, of suicide.")).toBeInTheDocument();
  });

  it("tells the closing passage and the line after it (DEATH-002)", () => {
    render(<SummaryScreen {...props(view())} />);
    expect(screen.getByText(en[base.death.passageKey]!)).toBeInTheDocument();
    expect(screen.getByText(en[base.death.codaKey]!)).toBeInTheDocument();
  });

  it("gives no score and no rank", () => {
    const { container } = render(<SummaryScreen {...props(view())} />);
    expect(container.textContent).not.toMatch(/\b(score|rank|points|grade)\b/i);
  });

  it("has sections as headings below the name, and the seed with a label (RNG-003)", () => {
    render(<SummaryScreen {...props(view())} />);
    const tags = screen.getAllByRole("heading").map((h) => h.tagName);
    expect(tags[0]).toBe("H1");
    expect(tags.slice(1).every((tag) => tag === "H2")).toBe(true);
    expect(
      screen.getByText("The seed of this life is summary-seed-1. It is what the game used to draw this birth."),
    ).toBeInTheDocument();
  });

  it("offers another life, the past lives and the start screen", async () => {
    const user = userEvent.setup();
    const p = props(view());
    render(<SummaryScreen {...p} />);
    await user.click(screen.getByRole("button", { name: "Begin another life" }));
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    await user.click(screen.getByRole("button", { name: "Back to start" }));
    expect(p.onAnother).toHaveBeenCalledTimes(1);
    expect(p.onPast).toHaveBeenCalledTimes(1);
    expect(p.onBack).toHaveBeenCalledTimes(1);
  });

  it("is the same for a life opened from the archive, with its epitaph shown", () => {
    render(<SummaryScreen {...props(view({ epitaph: "Kept bees." }, [], true))} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(base.name);
    expect(screen.getByText("Kept bees.").tagName).toBe("BLOCKQUOTE");
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Begin another life" })).toBeInTheDocument();
  });

  it("says politely when the archive would not keep the life", () => {
    const { rerender } = render(<SummaryScreen {...props(view())} />);
    expect(screen.queryByText(/could not be kept in your past lives/)).not.toBeInTheDocument();
    rerender(<SummaryScreen {...props(view(), { problem: "archive" })} />);
    expect(screen.getByText(/could not be kept in your past lives/)).toBeInTheDocument();
  });
});

describe("DEATH-003: the life against the life expectancy", () => {
  it("says a shorter life was shorter, with the source, the year and how many reach that age", () => {
    const shorter = { expected: 63.4, difference: -22.4, verdict: "shorter", reached: 0.213 } as const;
    render(<SummaryScreen {...props(ended(41, shorter, "female"))} />);
    expect(
      screen.getByText(
        "In Testland, a woman can expect to live about 63 years (Synthetic test data, 2023). You lived 41 years, 22 years fewer. About 21 in 100 women there live to 41.",
      ),
    ).toBeInTheDocument();
  });

  it("says a longer life was longer", () => {
    const longer = { expected: 63.4, difference: 27.6, verdict: "longer", reached: 0.04 } as const;
    render(<SummaryScreen {...props(ended(91, longer))} />);
    expect(
      screen.getByText(
        "In Testland, a man can expect to live about 63 years (Synthetic test data, 2023). You lived 91 years, 28 years more. About 4 in 100 men there live to 91.",
      ),
    ).toBeInTheDocument();
  });

  it("says a similar life was about as long", () => {
    const similar = { expected: 63.4, difference: -1.4, verdict: "similar", reached: 0.55 } as const;
    render(<SummaryScreen {...props(ended(62, similar))} />);
    expect(
      screen.getByText(/You lived 62 years, about as long\. About 55 in 100 men there live to 62\./),
    ).toBeInTheDocument();
  });

  it("does not say how many reach an age nearly everyone reaches, and says it plainly for a baby", () => {
    render(
      <SummaryScreen
        {...props(ended(0, { expected: 63.4, difference: -63.4, verdict: "shorter", reached: 1 }, "female"))}
      />,
    );
    const line = screen.getByText(/You lived less than a year, 63 years fewer\./);
    expect(line.textContent).not.toMatch(/in 100/);
  });

  it("says fewer than 1 in 100 when almost nobody gets that far", () => {
    render(
      <SummaryScreen {...props(ended(104, { expected: 63.4, difference: 40.6, verdict: "longer", reached: 0.001 }))} />,
    );
    expect(screen.getByText(/Fewer than 1 in 100 men there live to 104\./)).toBeInTheDocument();
  });

  it("names the source by its id when the index does not have it", () => {
    render(
      <SummaryScreen
        {...props(ended(41, { source: "unknown-source", verdict: "shorter", reached: 0.5 }), { sources: {} })}
      />,
    );
    expect(screen.getByText(/\(unknown-source, 2023\)/)).toBeInTheDocument();
  });
});

describe("SUM-002, SUM-003: the rings and the key moments", () => {
  it("draws one ring for each year of the life", () => {
    const { container } = render(<SummaryScreen {...props(view())} />);
    expect(container.querySelectorAll("circle[data-ring]")).toHaveLength(base.rings.length);
    expect(screen.getByRole("img", { name: new RegExp(`${base.name}'s life`) })).toBeInTheDocument();
  });

  it("lists the key moments in order, numbered like the marks on the rings", () => {
    const { container } = render(<SummaryScreen {...props(view())} />);
    expect(base.moments.length).toBeGreaterThanOrEqual(1);
    const list = container.querySelector("ol")!;
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(base.moments.length);
    base.moments.forEach((moment, index) => {
      expect(items[index]!.textContent).toContain(`At ${moment.age}: ${t(moment.textKey, moment.vars)}`);
    });
    const marks = [...container.querySelectorAll("[data-mark]")].map((mark) => mark.textContent);
    expect(marks).toEqual(base.moments.map((_, index) => String(index + 1)));
    // The mark of moment n is on the ring of the age that moment n is about.
    const rings = base.rings.filter((ring) => ring.moment !== undefined);
    expect(rings.map((ring) => [ring.moment, ring.age])).toEqual(base.moments.map((m, i) => [i + 1, m.age]));
  });

  it("adds what the player chose, and what came of it, to a moment with a decision", () => {
    const moment: Moment = {
      age: 12,
      eventId: "test.decision",
      textKey: "event.midlife.looking_back",
      theme: "plain",
      decision: { choiceId: "c", choiceTextKey: "life.continue", outcomeTextKey: "life.quietYear" },
    };
    const { container } = render(<SummaryScreen {...props(view({ moments: [moment] }))} />);
    const item = within(container.querySelector("ol")!).getByRole("listitem");
    expect(item).toHaveTextContent("At 12: You catch yourself telling a story you have never told.");
    expect(item).toHaveTextContent("You chose: Continue to the next year");
    expect(item).toHaveTextContent("A quiet year.");
  });
});

describe("SUM-004: what shaped the life", () => {
  const shaping = (dominant: Shaping["stats"]["health"]["dominant"][]): Shaping => {
    const [health, happiness, belonging, skills] = dominant as [
      Shaping["stats"]["health"]["dominant"],
      Shaping["stats"]["health"]["dominant"],
      Shaping["stats"]["health"]["dominant"],
      Shaping["stats"]["health"]["dominant"],
    ];
    const shares = { circumstance: 0.5, choice: 0.3, chance: 0.2 };
    return {
      stats: {
        health: { shares, dominant: health },
        happiness: { shares, dominant: happiness },
        belonging: { shares, dominant: belonging },
        skills: { shares, dominant: skills },
      },
      overall: shares,
    };
  };

  it("says in words what each stat came from, and the shares of the whole", () => {
    render(<SummaryScreen {...props(view({ shaping: shaping(["circumstance", "chance", "choice", "mixed"]) }))} />);
    for (const key of [
      "summary.shaped.health.circumstance",
      "summary.shaped.happiness.chance",
      "summary.shaped.belonging.choice",
      "summary.shaped.skills.mixed",
    ]) {
      expect(screen.getByText(en[key]!)).toBeInTheDocument();
    }
    expect(
      screen.getByText(
        "Across your health, happiness, belonging and skills together, about 50% came from circumstance, 30% from choice and 20% from chance.",
      ),
    ).toBeInTheDocument();
  });

  it("makes the percentages add up to 100", () => {
    const third = 1 / 3;
    const even = shaping(["mixed", "mixed", "mixed", "mixed"]);
    render(
      <SummaryScreen
        {...props(view({ shaping: { ...even, overall: { circumstance: third, choice: third, chance: third } } }))}
      />,
    );
    expect(
      screen.getByText(/about 34% came from circumstance, 33% from choice and 33% from chance/),
    ).toBeInTheDocument();
  });

  it("explains how it is worked out, in a section that is closed until opened", async () => {
    const user = userEvent.setup();
    render(<SummaryScreen {...props(view())} />);
    const how = screen.getByText("How this is worked out");
    expect(how.closest("details")).not.toHaveAttribute("open");
    await user.click(how);
    expect(how.closest("details")).toHaveAttribute("open");
    expect(screen.getByText(/They are not credit or blame\./)).toBeInTheDocument();
  });
});

describe("SUM-001: the life in brief", () => {
  const facts = (changes: Partial<LifeFacts> = {}): LifeFacts => ({
    education: "upper-secondary",
    literate: true,
    yearsWorked: 31,
    sector: "agriculture",
    children: 2,
    siblings: 3,
    partnered: true,
    conditions: ["malaria", "depression"],
    moves: 2,
    ...changes,
  });
  const ageAt = (age: number) => ({ death: { ...base.death, age } });
  it("says only what is true of the life", () => {
    render(<SummaryScreen {...props(view({ facts: facts(), ...ageAt(70) }))} />);
    const section = screen.getByRole("heading", { name: "Your life in brief" }).nextElementSibling!;
    expect([...section.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "You finished upper secondary school.",
      "You could read and write.",
      "You spent 31 years in paid work, last in agriculture.",
      "You had 2 children.",
      "You had 3 brothers and sisters.",
      "You had a partner or spouse in your life.",
      "You lived with malaria and depression.",
      "You moved between the countryside and a town or city 2 times.",
    ]);
  });

  it("says what is absent for an adult, in plain sentences", () => {
    render(
      <SummaryScreen
        {...props(
          view({
            facts: facts({
              education: "none",
              literate: false,
              yearsWorked: 0,
              sector: undefined,
              children: 0,
              siblings: 0,
              partnered: false,
              conditions: [],
              moves: 0,
            }),
            ...ageAt(40),
          }),
        )}
      />,
    );
    const section = screen.getByRole("heading", { name: "Your life in brief" }).nextElementSibling!;
    expect([...section.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "You did not complete a level of school.",
      "You never learned to read well.",
      "You were never in paid work.",
      "You had no children.",
      "You had no brothers or sisters.",
      "You did not have a partner or spouse.",
    ]);
  });

  it("leaves out what does not apply to a very young life", () => {
    render(
      <SummaryScreen
        {...props(
          view({
            facts: facts({
              education: "none",
              literate: undefined,
              yearsWorked: 0,
              sector: undefined,
              children: 0,
              siblings: 1,
              partnered: false,
              conditions: [],
              moves: 1,
            }),
            ...ageAt(2),
          }),
        )}
      />,
    );
    const section = screen.getByRole("heading", { name: "Your life in brief" }).nextElementSibling!;
    expect([...section.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "You had 1 brother or sister.",
      "You moved between the countryside and a town or city once.",
    ]);
  });
});

describe("SUM-001: the last year", () => {
  it("tells the events of the last year, with their help and data notes", () => {
    render(
      <SummaryScreen
        {...props(
          view({}, [
            event({ id: "a" }),
            event({ id: "b", textKey: "event.family.relative_died", vars: { name: "Kwame" }, helpTopic: "grief" }),
          ]),
        )}
      />,
    );
    expect(screen.getByRole("heading", { name: "Your last year" })).toBeInTheDocument();
    expect(screen.getByText(/telling a story you have never told/)).toBeInTheDocument();
    expect(screen.getByText(/Kwame dies\./)).toBeInTheDocument();
    expect(screen.getByText(en["help.grief"]!)).toBeInTheDocument();
  });

  it("has no section for a year with nothing to tell", () => {
    render(<SummaryScreen {...props(view())} />);
    expect(screen.queryByRole("heading", { name: "Your last year" })).not.toBeInTheDocument();
  });
});

describe("DEATH-002, UI-012: a death by suicide", () => {
  const selfHarm = (): Partial<LifeSummary> => ({
    death: { ...base.death, cause: "selfHarm", group: "selfHarm", passageKey: "death.passage.selfHarm" },
  });

  it("is stated in the passage and always followed by the help and the link", () => {
    render(<SummaryScreen {...props(view(selfHarm()))} />);
    expect(screen.getByText(en["death.passage.selfHarm"]!)).toBeInTheDocument();
    expect(screen.getByText(en["help.suicide"]!)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "findahelpline.com" })).toHaveAttribute(
      "href",
      "https://findahelpline.com",
    );
  });

  it("shows the help once when the year's own event already carries it", () => {
    render(<SummaryScreen {...props(view(selfHarm(), [event({ helpTopic: "suicide" })]))} />);
    expect(screen.getAllByText(en["help.suicide"]!)).toHaveLength(1);
  });

  it("shows no help for other deaths", () => {
    render(<SummaryScreen {...props(view())} />);
    expect(screen.queryByText(en["help.suicide"]!)).not.toBeInTheDocument();
  });
});

describe("DEATH-004: the epitaph", () => {
  /** What the store does: keep the words tidied, or none when empty. */
  function Harness({ first, onSave }: { first?: string; onSave?: (text: string) => void }) {
    const [epitaph, setEpitaph] = useState(first);
    const summary: LifeSummary = { ...base, ...(epitaph ? { epitaph } : {}) };
    return (
      <SummaryScreen
        {...props(
          { summary, lastYear: [], archived: false },
          {
            onEpitaph: (text) => {
              onSave?.(text);
              setEpitaph(text.trim() || undefined);
            },
          },
        )}
      />
    );
  }
  const field = () => screen.getByRole("textbox", { name: `A few words for ${base.name}` });

  it("is offered as a labelled field with the characters left and a Save button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(field()).toHaveAttribute("maxlength", String(EPITAPH_MAX_LENGTH));
    expect(field()).toHaveAccessibleDescription(`${EPITAPH_MAX_LENGTH} characters left`);
    await user.type(field(), "Kept bees");
    expect(field()).toHaveAccessibleDescription(`${EPITAPH_MAX_LENGTH - 9} characters left`);
  });

  it("is saved with the button or with Enter, shown as a quotation, and announced politely", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await user.type(field(), "Kept bees.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("Kept bees.");
    expect(screen.getByText("Kept bees.").tagName).toBe("BLOCKQUOTE");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(`Your words for ${base.name} are saved.`).closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    // Focus moves to the Edit button, not to the page.
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
  });

  it("is saved by Enter in the field", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await user.type(field(), "Walked far{Enter}");
    expect(onSave).toHaveBeenCalledWith("Walked far");
  });

  it("saves nothing when there are no words", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.type(field(), "   {Enter}");
    expect(onSave).not.toHaveBeenCalled();
    expect(field()).toBeInTheDocument();
  });

  it("says to write a few words first when Save is pressed with nothing written, through the live region", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const live = screen.getByText(
      (_, element) => element?.getAttribute("aria-live") === "polite" && element.tagName === "P",
    );
    expect(live).toBeEmptyDOMElement();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(live).toHaveTextContent("Write a few words first.");
    expect(field()).toBeInTheDocument();
  });

  it("says it again, as a new node, when Save is pressed with nothing written twice", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const live = screen.getByText(
      (_, element) => element?.getAttribute("aria-live") === "polite" && element.tagName === "P",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    const first = live.firstElementChild;
    expect(first).toHaveTextContent("Write a few words first.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(live).toHaveTextContent("Write a few words first.");
    expect(live.firstElementChild).not.toBe(first);
  });

  it("says once that no characters are left when the limit is reached, and stops saying it after a deletion", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const live = screen.getByText(
      (_, element) => element?.getAttribute("aria-live") === "polite" && element.tagName === "P",
    );
    await user.type(field(), "x".repeat(EPITAPH_MAX_LENGTH - 1));
    expect(live).toBeEmptyDOMElement();
    await user.type(field(), "y");
    expect(live).toHaveTextContent("No characters left");
    // More typing is stopped by the field and says nothing new.
    await user.type(field(), "zz");
    expect(field()).toHaveValue("x".repeat(EPITAPH_MAX_LENGTH - 1) + "y");
    await user.keyboard("{Backspace}");
    expect(live).toBeEmptyDOMElement();
  });

  it("is edited from the quotation, with the keyboard, and can be cancelled", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness first="Kept bees." onSave={onSave} />);
    await user.tab();
    const edit = screen.getByRole("button", { name: "Edit" });
    edit.focus();
    await user.keyboard("{Enter}");
    expect(field()).toHaveValue("Kept bees.");
    expect(field()).toHaveFocus();
    await user.keyboard(" Loved them.{Enter}");
    expect(onSave).toHaveBeenCalledWith("Kept bees. Loved them.");
    expect(screen.getByText("Kept bees. Loved them.").tagName).toBe("BLOCKQUOTE");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(field(), "x");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Kept bees. Loved them.").tagName).toBe("BLOCKQUOTE");
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
  });

  it("is removed by saving it empty, which says so", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness first="Kept bees." onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(field());
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("");
    expect(screen.queryByRole("blockquote")).not.toBeInTheDocument();
    expect(screen.getByText(`The words for ${base.name} were removed.`)).toBeInTheDocument();
    expect(field()).toHaveValue("");
  });

  it("does not take focus when a life is opened with its epitaph already written", () => {
    render(<Harness first="Kept bees." />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });
});

describe("SUM-005: the notes", () => {
  const journal = [
    { age: 6, prompt: "school.start", text: "Friends, I hope." },
    { age: 30, text: "A good year." },
    { age: 41, prompt: "no.longer.a.prompt", text: "Kept anyway." },
  ];

  it("lists the journal in the order of the years, with the prompt a line answered above it", () => {
    render(<SummaryScreen {...props(view({ journal }))} />);
    const section = within(screen.getByRole("region", { name: "Your notes" }));
    const items = section.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("At 6");
    expect(items[0]).toHaveTextContent(en["reflection.school.start"]!);
    expect(items[0]).toHaveTextContent("Friends, I hope.");
    expect(items[1]).toHaveTextContent(/^At 30\s*A good year\.$/);
    // A prompt this version no longer has is left out; the line itself stays.
    expect(items[2]).toHaveTextContent(/^At 41\s*Kept anyway\.$/);
  });

  it("comes before the epitaph, which keeps its place and behaviour", () => {
    render(<SummaryScreen {...props(view({ journal, epitaph: "Kept bees." }))} />);
    const notes = screen.getByRole("heading", { name: "Your notes" });
    const epitaph = screen.getByRole("heading", { name: "A few words" });
    expect(notes.compareDocumentPosition(epitaph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Kept bees.").tagName).toBe("BLOCKQUOTE");
  });

  it("is left out when nothing was written, and for an archived summary kept before there was a journal", () => {
    const { rerender } = render(<SummaryScreen {...props(view({ journal: [] }))} />);
    expect(screen.queryByRole("heading", { name: "Your notes" })).not.toBeInTheDocument();
    const old = { ...base } as Partial<LifeSummary>;
    delete old.journal;
    rerender(<SummaryScreen {...props({ summary: old as LifeSummary, lastYear: [], archived: true })} />);
    expect(screen.queryByRole("heading", { name: "Your notes" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(base.name);
  });

  it("is shown for a past life opened from the archive", () => {
    render(<SummaryScreen {...props(view({ journal }, [], true))} />);
    expect(within(screen.getByRole("region", { name: "Your notes" })).getAllByRole("listitem")).toHaveLength(3);
  });
});
