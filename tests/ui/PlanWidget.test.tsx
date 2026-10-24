// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Plan } from "../../src/engine/types";
import { LifeScreen } from "../../src/ui/LifeScreen";
import { PlanWidget } from "../../src/ui/PlanWidget";
import { planOverview, planToSend, type PlanOverview } from "../../src/ui/store";
import { makeCountry } from "../fixtures/country";
import { makePerson } from "../fixtures/person";
import { lifeOf, lifeScreenProps } from "./helpers";

// SYNTHETIC people and plans: the overview is derived from the engine's own rules (DEC-003, DEC-004).
const country = makeCountry();
const areas = ["learn", "earn", "health", "bond", "rest"] as const;

const overview = (changes: Partial<PlanOverview> = {}): PlanOverview => ({
  areas,
  free: 3,
  chosen: { learn: 1, earn: 0, health: 1, bond: 1, rest: 0 },
  forced: [],
  locked: {},
  custom: false,
  ...changes,
});

/** The widget with its draft kept in state, as the life screen does. */
function Harness({ plan, onDraft }: { plan: PlanOverview; onDraft?: (draft: Plan) => void }) {
  const [draft, setDraft] = useState<Plan>(plan.chosen);
  return (
    <PlanWidget
      plan={plan}
      draft={draft}
      onChange={(next) => {
        setDraft(next);
        onDraft?.(next);
      }}
    />
  );
}

const field = (name: string) => screen.getByRole("textbox", { name });

describe("plan widget (UI-005, DEC-003)", () => {
  it("lets the player place points across the five areas by keyboard and counts what is left", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    render(<Harness plan={overview()} onDraft={onDraft} />);
    expect(screen.getByRole("region", { name: "Where your attention goes" })).toBeInTheDocument();
    expect(screen.getByText("All points placed.")).toBeInTheDocument();

    // Taking a point off Learn leaves one to place; the field cannot go past what is left.
    await user.click(field("Learn"));
    await user.keyboard("{ArrowDown}");
    expect(field("Learn")).toHaveValue("0");
    expect(screen.getByText(/1 point left to place/)).toBeInTheDocument();

    await user.tab();
    await user.tab();
    expect(field("Health")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(field("Health")).toHaveValue("2");
    expect(screen.getByText("All points placed.")).toBeInTheDocument();
    await user.keyboard("{ArrowUp}");
    expect(field("Health")).toHaveValue("2");
    expect(onDraft).toHaveBeenLastCalledWith({ learn: 0, earn: 0, health: 2, bond: 1, rest: 0 });
  });

  it("can be operated by touch with the plus and minus buttons", async () => {
    const user = userEvent.setup();
    render(<Harness plan={overview()} />);
    await user.click(screen.getByRole("button", { name: /Decrease Bond/ }));
    expect(field("Bond")).toHaveValue("0");
    await user.click(screen.getByRole("button", { name: /Increase Rest/ }));
    expect(field("Rest")).toHaveValue("1");
    // Every point is placed, so no area can take another until one is given back.
    expect(screen.getByRole("button", { name: /Increase Rest/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Increase Learn/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Decrease Rest/ })).toBeEnabled();
  });

  it("says in one plain line what each area does, tied to its field", () => {
    render(<Harness plan={overview()} />);
    expect(field("Learn")).toHaveAccessibleDescription("Skills and school.");
    expect(field("Earn")).toHaveAccessibleDescription(/Income and work\./);
    expect(field("Health")).toHaveAccessibleDescription("Health and care.");
    expect(field("Bond")).toHaveAccessibleDescription("Belonging and friends.");
    expect(field("Rest")).toHaveAccessibleDescription("Happiness and resilience.");
  });

  it("shows each point circumstance has taken, with its reason in words", () => {
    render(
      <Harness
        plan={overview({
          free: 1,
          chosen: { learn: 1, earn: 0, health: 0, bond: 0, rest: 0 },
          forced: [
            { area: "health", points: 1, reason: "illness" },
            { area: "bond", points: 1, reason: "caregiving" },
          ],
        })}
      />,
    );
    const taken = screen.getByRole("list", { name: "Already taken" });
    const lines = within(taken).getAllByRole("listitem");
    expect(lines[0]).toHaveTextContent("Health, 1 point. Your illness takes it first.");
    expect(lines[1]).toHaveTextContent(
      "Bond, 1 point. Someone in your family needs looking after, and that comes first.",
    );
    // Only one point is the player's to place.
    expect(screen.getByText("All points placed.")).toBeInTheDocument();
    expect(field("Health")).toHaveAccessibleDescription(/1 point already taken\./);
  });

  it("explains a locked area in words, and the reason is read with the field", () => {
    render(<Harness plan={overview({ locked: { earn: "tooYoung" } })} />);
    expect(field("Earn")).toBeDisabled();
    expect(field("Earn")).toHaveAccessibleDescription(/You are too young for paid work\./);
    expect(screen.getByText(/You are too young for paid work\./)).toBeVisible();
  });

  it("says a retired person has stopped working", () => {
    render(<Harness plan={overview({ locked: { earn: "retired" } })} />);
    expect(field("Earn")).toHaveAccessibleDescription(/You have retired from work\./);
  });

  it("says whether the points follow the situation or were set by the player", () => {
    const { rerender } = render(<Harness plan={overview()} />);
    expect(screen.getByText(/follow what suits your situation/)).toBeInTheDocument();
    rerender(<Harness plan={overview({ custom: true })} />);
    expect(screen.getByText(/These are the points you set/)).toBeInTheDocument();
  });
});

describe("what Continue sends", () => {
  const view = overview();

  it("sends nothing while the draft is what the plan already is", () => {
    expect(planToSend(view, view.chosen)).toBeUndefined();
  });

  it("sends the draft once it differs", () => {
    const draft = { learn: 2, earn: 0, health: 0, bond: 1, rest: 0 };
    expect(planToSend(view, draft)).toEqual(draft);
  });

  it("puts points left unplaced into Rest, so the plan spends exactly the points available", () => {
    expect(planToSend(view, { learn: 0, earn: 0, health: 1, bond: 1, rest: 0 })).toEqual({
      learn: 0,
      earn: 0,
      health: 1,
      bond: 1,
      rest: 1,
    });
  });

  it("sends nothing when unplaced points would only restore the current plan", () => {
    const resting = overview({ chosen: { learn: 1, earn: 0, health: 1, bond: 0, rest: 1 } });
    expect(planToSend(resting, { learn: 1, earn: 0, health: 1, bond: 0, rest: 0 })).toBeUndefined();
  });
});

describe("the plan on the life screen", () => {
  const child = makePerson({ age: 8 });
  const life = lifeOf(child);

  it("shows the widget from age six and carries the plan over: Continue with no change sends no plan", async () => {
    const user = userEvent.setup();
    const props = lifeScreenProps(country, { life, plan: planOverview(life) });
    render(<LifeScreen {...props} />);
    expect(screen.getByRole("region", { name: "Where your attention goes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(props.onContinue).toHaveBeenCalledWith(undefined);
  });

  it("sends the plan the player placed", async () => {
    const user = userEvent.setup();
    const props = lifeScreenProps(country, { life, plan: planOverview(life) });
    render(<LifeScreen {...props} />);
    // A child of eight follows Learn, Health, Bond; Earn is locked for them.
    expect(field("Earn")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Decrease Bond/ }));
    await user.click(screen.getByRole("button", { name: /Increase Rest/ }));
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(props.onContinue).toHaveBeenCalledWith({ learn: 1, earn: 0, health: 1, bond: 0, rest: 1 });
  });

  it("shows nothing before age six", () => {
    const baby = lifeOf(makePerson({ age: 3 }));
    expect(planOverview(baby)).toBeNull();
    render(<LifeScreen {...lifeScreenProps(country, { life: baby, plan: null })} />);
    expect(screen.queryByRole("region", { name: "Where your attention goes" })).not.toBeInTheDocument();
  });

  it("starts the next year from the plan the store reports, not from an old draft", async () => {
    const user = userEvent.setup();
    const props = lifeScreenProps(country, { life, plan: planOverview(life) });
    const { rerender } = render(<LifeScreen {...props} />);
    await user.click(screen.getByRole("button", { name: /Decrease Bond/ }));
    const older = lifeOf(makePerson({ age: 9 }));
    rerender(<LifeScreen {...props} life={older} plan={planOverview(older)} />);
    expect(field("Bond")).toHaveValue("1");
  });
});
