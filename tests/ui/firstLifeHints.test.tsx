// @vitest-environment jsdom
// First-life hints (UI-015): a note the first time the plan, a decision and the odds lens are met, put away with one
// button or by doing what it explains, brought back from the settings. SYNTHETIC cards and people.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { DecisionCard } from "../../src/engine/decisions";
import { App } from "../../src/ui/App";
import { createHintStore, type HintStore } from "../../src/ui/hints";
import { LifeScreen } from "../../src/ui/LifeScreen";
import { createGameStore, planOverview } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { makePerson } from "../fixtures/person";
import { lifeOf, lifeScreenProps } from "./helpers";

const country = makeCountry({ region: "Western Africa" });

let hints: HintStore;
beforeEach(() => {
  window.localStorage.clear();
  hints = createHintStore(() => window.localStorage);
});

const hint = (text: RegExp) => screen.queryByText(text);
const PLAN = /place a few points of attention/;
const DECISION = /the year stops and asks you something/;
const LENS = /the odds are put in words/;

describe("the plan hint", () => {
  const child = makePerson({ age: 8 });
  const life = lifeOf(child);
  const props = () => lifeScreenProps(country, { life, plan: planOverview(life), hints });

  it("is a note beside the plan the first time it is shown, and moves nothing", () => {
    render(<LifeScreen {...props()} />);
    const note = screen.getByRole("note", { name: "" });
    expect(note).toHaveTextContent(PLAN);
    expect(note).toHaveTextContent("A hint");
    expect(screen.getByRole("button", { name: "Got it" })).not.toHaveFocus();
    expect(screen.getByRole("region", { name: "Where your attention goes" })).toBeInTheDocument();
  });

  it("is put away with Got it, and focus goes to the year's heading", async () => {
    const user = userEvent.setup();
    render(<LifeScreen {...props()} />);
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(hint(PLAN)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(hints.getSnapshot()).toEqual(["plan"]);
  });

  it("is put away by placing points", async () => {
    const user = userEvent.setup();
    render(<LifeScreen {...props()} />);
    await user.click(screen.getByRole("button", { name: /Decrease Learn/ }));
    expect(hint(PLAN)).not.toBeInTheDocument();
    expect(hints.getSnapshot()).toEqual(["plan"]);
  });

  it("is put away by going on to the next year", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<LifeScreen {...p} />);
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(p.onContinue).toHaveBeenCalledWith(undefined);
    expect(hints.getSnapshot()).toEqual(["plan"]);
  });

  it("is not shown again once seen, or while a decision waits", () => {
    hints.see("plan");
    const { unmount } = render(<LifeScreen {...props()} />);
    expect(hint(PLAN)).not.toBeInTheDocument();
    unmount();
    hints.reset();
    render(<LifeScreen {...props()} plan={null} />);
    expect(hint(PLAN)).not.toBeInTheDocument();
  });
});

describe("the decision and odds lens hints", () => {
  const card = (lens: boolean): DecisionCard => ({
    eventId: "test.card",
    textKey: "event.edu.leave_school_for_work.pressure",
    vars: {},
    choices: [
      { id: "stay", textKey: "choice.edu.leave.stay", lens: [] },
      {
        id: "leave",
        textKey: "choice.edu.leave.leave",
        lens: lens ? [{ key: "lens.stay_in_school", p: 0.6, band: { kind: "fraction", num: 2, den: 3 } }] : [],
      },
    ],
  });
  const props = (lens = true) => lifeScreenProps(country, { life: lifeOf(), card: card(lens), hints });

  it("sit in one note on the card, above the choices", () => {
    render(<LifeScreen {...props()} />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(DECISION);
    expect(note).toHaveTextContent(LENS);
    expect(within(note).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "A decision" })).toHaveFocus();
  });

  it("leave the odds lens out where no choice has odds to show", () => {
    render(<LifeScreen {...props(false)} />);
    expect(hint(DECISION)).toBeInTheDocument();
    expect(hint(LENS)).not.toBeInTheDocument();
  });

  it("are put away together with Got it, and focus returns to the card's heading", async () => {
    const user = userEvent.setup();
    render(<LifeScreen {...props()} />);
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "A decision" })).toHaveFocus();
    expect(hints.getSnapshot()).toEqual(["decision", "lens"]);
  });

  it("are put away by answering, and a card without odds leaves the lens hint for a card with some", async () => {
    const user = userEvent.setup();
    const bare = props(false);
    const { unmount } = render(<LifeScreen {...bare} />);
    await user.click(screen.getByRole("button", { name: "Try to stay in school" }));
    expect(bare.onChoose).toHaveBeenCalledWith("stay");
    expect(hints.getSnapshot()).toEqual(["decision"]);
    unmount();
    render(<LifeScreen {...props()} />);
    expect(screen.getByRole("note")).not.toHaveTextContent(DECISION);
    expect(screen.getByRole("note")).toHaveTextContent(LENS);
  });

  it("leave the card as it was once they have been seen", () => {
    hints.see("decision", "lens");
    render(<LifeScreen {...props()} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Your choices" })).getAllByRole("button")).toHaveLength(2);
  });
});

describe("the hints in the app", () => {
  it("come back from the settings, and delete-all forgets which were seen", async () => {
    const user = userEvent.setup();
    hints.see("plan", "decision");
    const store = createGameStore(() => "seed-0", testWorld(country));
    render(<App store={store} hints={hints} />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    const again = screen.getByRole("button", { name: "Show the hints again" });
    expect(again).toBeEnabled();
    await user.click(again);
    expect(hints.getSnapshot()).toEqual([]);
    expect(again).toBeDisabled();
    expect(screen.getByText("No hint has been put away yet.")).toBeInTheDocument();
  });

  it("count as something stored, so delete all is offered, and are forgotten by it", async () => {
    const user = userEvent.setup();
    hints.see("plan");
    const store = createGameStore(() => "seed-0", testWorld(country));
    render(<App store={store} hints={hints} />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    await user.click(screen.getByRole("button", { name: "Delete all local data" }));
    await user.click(await screen.findByRole("button", { name: "Delete everything" }));
    await screen.findByRole("button", { name: "Begin a life" });
    expect(hints.getSnapshot()).toEqual([]);
  });
});
