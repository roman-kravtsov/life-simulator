// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { en } from "../../src/content/strings/en";
import type { DecisionCard } from "../../src/engine/decisions";
import { App } from "../../src/ui/App";
import { LifeScreen } from "../../src/ui/LifeScreen";
import { createGameStore, type GameStore } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { lifeOf, lifeScreenProps } from "./helpers";

const country = makeCountry({ region: "Western Africa" });

/** A store with a real life, played with the default plan until the first decision (or death) comes up. */
async function storeAtDecision(seed: string): Promise<GameStore> {
  const store = createGameStore(() => seed, testWorld(country));
  await store.begin();
  store.startLife();
  while (store.getSnapshot().life?.person.alive && !store.getSnapshot().card) store.continueYear();
  return store;
}

const choiceButtons = () => within(screen.getByRole("list", { name: "Your choices" })).getAllByRole("button");

describe("decision card from the engine (UI-006, DEC-001, DEC-002, DEC-005)", () => {
  // Seed 3 reaches higher education at 17: one choice costs money each year, one is locked.
  it("moves focus to the card heading, announces it, and offers every choice", async () => {
    const store = await storeAtDecision("seed-3");
    render(<App store={store} />);
    const heading = screen.getByRole("heading", { level: 2, name: "A decision" });
    expect(heading).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("A decision is waiting.");
    expect(choiceButtons().map((b) => b.textContent)).toHaveLength(3);
    // The year is on hold: nothing to continue to until the player answers.
    expect(screen.queryByRole("button", { name: "Continue to the next year" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Where your attention goes" })).not.toBeInTheDocument();
  });

  it("reads the situation with the focused heading, so a screen reader hears what the decision is about", async () => {
    const store = await storeAtDecision("seed-3");
    render(<App store={store} />);
    const heading = screen.getByRole("heading", { level: 2, name: "A decision" });
    expect(heading).toHaveAccessibleDescription(/\S{3,}/);
    const text = heading.getAttribute("aria-describedby");
    expect(document.getElementById(text ?? "")).toBe(heading.parentElement?.querySelector("p"));
  });

  it("says why a locked choice cannot be taken when it is pressed", async () => {
    const user = userEvent.setup();
    const store = await storeAtDecision("seed-3");
    render(<App store={store} />);
    const locked = screen.getByRole("button", { name: "Try for a scholarship" });
    const region = screen.getByRole("region", { name: "A decision" }).querySelector("[aria-live=polite]");
    expect(region).toHaveTextContent(/^$/);
    locked.focus();
    await user.keyboard("{Enter}");
    expect(region).toHaveTextContent(/^Not open to you: Scholarships go to those with strong results/);
    // A second press is announced again: the notice is a new node each time.
    const first = region?.firstElementChild;
    await user.keyboard("{Enter}");
    expect(region?.firstElementChild).not.toBe(first);
    expect(region).toHaveTextContent(/^Not open to you: Scholarships go to those with strong results/);
  });

  it("shows a locked choice with its reason in words, reachable by keyboard and by screen reader", async () => {
    const user = userEvent.setup();
    const store = await storeAtDecision("seed-3");
    render(<App store={store} />);
    const locked = screen.getByRole("button", { name: "Try for a scholarship" });
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(locked).toHaveAccessibleDescription(/Not open to you: Scholarships go to those with strong results/);
    expect(screen.getByText(/Not open to you: Scholarships go to those with strong results/)).toBeVisible();
    // It can be focused, so its reason is found by keyboard, but it does nothing.
    locked.focus();
    expect(locked).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.click(locked);
    expect(store.getSnapshot().card).not.toBeNull();
    expect(store.getSnapshot().life?.turn).toBeDefined();
  });

  it("says costs through the money formatter and odds in words, never as decimals or percentages", async () => {
    const store = await storeAtDecision("seed-3");
    render(<App store={store} />);
    const card = screen.getByRole("region", { name: "A decision" });
    expect(card).toHaveTextContent(/Costs \$[\d,]+ each year \(international dollars\)\./);
    expect(card).toHaveTextContent("finish the course once you begin: about 1 in 5");
    expect(card.textContent).not.toMatch(/%|\d\.\d/);
    expect(screen.getByRole("button", { name: /Enrol in higher education/ })).toHaveAccessibleDescription(/each year/);
  });

  it("takes the choice that is clicked, tells what was chosen and what came of it, and moves focus back", async () => {
    const user = userEvent.setup();
    const store = await storeAtDecision("seed-3");
    render(<App store={store} />);
    const before = store.getSnapshot().life!;
    await user.click(screen.getByRole("button", { name: "Go straight to work" }));
    const after = store.getSnapshot();
    expect(after.card).toBeNull();
    expect(after.life?.decisions.at(-1)).toMatchObject({ eventId: "edu.higher_education", choiceId: "work" });
    expect(after.life!.history.length).toBeGreaterThan(before.history.length);
    expect(screen.queryByRole("heading", { name: "A decision" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(screen.getByText("You chose: Go straight to work")).toBeInTheDocument();
  });

  it("can be answered with the keyboard alone", async () => {
    const user = userEvent.setup();
    const store = await storeAtDecision("seed-3");
    render(<App store={store} />);
    const [first] = choiceButtons();
    first!.focus();
    await user.keyboard("{Enter}");
    expect(store.getSnapshot().card).toBeNull();
  });

  it("follows a sensitive decision with the help for its topic", async () => {
    const store = await storeAtDecision("seed-5"); // a bully at eleven: violence
    render(<App store={store} />);
    const card = screen.getByRole("region", { name: "A decision" });
    expect(card).toHaveTextContent(/free, confidential helplines/);
    expect(within(card).getByRole("link", { name: "findahelpline.com" })).toHaveAttribute(
      "href",
      "https://findahelpline.com",
    );
  });
});

describe("decision card from a synthetic card", () => {
  const card: DecisionCard = {
    eventId: "test.card",
    textKey: "event.edu.leave_school_for_work.pressure",
    vars: {},
    dataNote: { textKey: "note.child_labour", value: 0.1, source: "test", year: 2023 },
    choices: [
      { id: "stay", textKey: "choice.edu.leave.stay", cost: { amount: 45.5 }, lens: [] },
      {
        id: "leave",
        textKey: "choice.edu.leave.leave",
        lens: [
          { key: "lens.stay_in_school", p: 0.6, band: { kind: "fraction", num: 2, den: 3 } },
          { key: "lens.leave_anyway", p: 0.01, band: { kind: "almostNever" } },
          {
            key: "lens.stay_in_school",
            p: 0.97,
            band: { kind: "almostSure" },
            vs: 0.2,
            vsBand: { kind: "fraction", num: 1, den: 5 },
          },
        ],
      },
    ],
  };

  it("says a once-only cost without 'each year' and shows the data note like the story does", () => {
    render(<LifeScreen {...lifeScreenProps(country, { life: lifeOf(), card })} />);
    expect(screen.getByRole("button", { name: "Try to stay in school" })).toHaveAccessibleDescription(
      "Costs $45.50 (international dollars).",
    );
    expect(
      screen.getByText(/about 10% of children between 5 and 17 are in child labour \(Synthetic test data, 2023\)/),
    ).toBeInTheDocument();
  });

  it("speaks every kind of odds in words and says how the choice shifts them", () => {
    render(<LifeScreen {...lifeScreenProps(country, { life: lifeOf(), card })} />);
    const leave = screen.getByRole("button", { name: "Leave school and work" });
    const description = leave.getAttribute("aria-describedby")!;
    const text = document.getElementById(description)!.textContent!;
    expect(text).toContain("keep your place at school: about 2 in 3");
    expect(text).toContain("have to leave anyway: almost never");
    expect(text).toContain("keep your place at school: almost sure, otherwise about 1 in 5");
    expect(text).not.toMatch(/%|\d\.\d/);
  });

  it("calls the action with the id of the choice taken", async () => {
    const user = userEvent.setup();
    const props = lifeScreenProps(country, { life: lifeOf(), card });
    render(<LifeScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "Leave school and work" }));
    expect(props.onChoose).toHaveBeenCalledWith("leave");
  });
});

describe("suicide is never a choice (HEALTH-006, UI-012)", () => {
  const unsafe = /suicid|kill (yourself|myself)|end (it all|your life|your own life)|take your own life/i;

  it("is named in no choice or outcome text, whoever raises the decision", () => {
    const texts = Object.entries(en)
      .filter(([key]) => key.startsWith("choice.") || key.startsWith("outcome."))
      .map(([, text]) => text);
    expect(texts.length).toBeGreaterThan(20);
    for (const text of texts) expect(text).not.toMatch(unsafe);
  });
});
