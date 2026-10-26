// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Settings } from "../../src/engine/types";
import { App } from "../../src/ui/App";
import { createGameStore } from "../../src/ui/store";
import { testWorld } from "../fixtures/country";
import { deadlyCountry } from "./fakes";
import { backToStart, skipReveal } from "./helpers";

const setup = (settings?: Partial<Settings>) => {
  const store = createGameStore(() => "test-seed", testWorld());
  if (settings) store.setSettings(settings);
  render(<App store={store} />);
  return { user: userEvent.setup(), store };
};

const begin = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Begin a life" }));
  await skipReveal(user);
  await screen.findByRole("button", { name: "Begin this life" });
};

const startLife = async (user: ReturnType<typeof userEvent.setup>) => {
  await begin(user);
  await user.click(screen.getByRole("button", { name: "Begin this life" }));
};

/** Tabs until the element has focus, so the test follows the real tab order and fails if it is unreachable. */
const tabTo = async (user: ReturnType<typeof userEvent.setup>, element: HTMLElement) => {
  for (let i = 0; i < 12 && document.activeElement !== element; i++) await user.tab();
  expect(element).toHaveFocus();
};

/** Answers any decision that is waiting with the first choice that is open. */
const answerDecisions = async (user: ReturnType<typeof userEvent.setup>) => {
  while (screen.queryByRole("heading", { level: 2, name: "A decision" })) {
    const open = within(screen.getByRole("list", { name: "Your choices" }))
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-disabled") !== "true");
    await user.click(open[0]!);
  }
};

const nextYear = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
  await answerDecisions(user);
};

describe("App", () => {
  it("shows the title, the content note and a way to begin", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Birthright");
    expect(screen.getByRole("note")).toHaveTextContent(/suicide/);
    expect(screen.getByRole("button", { name: "Begin a life" })).toBeInTheDocument();
  });

  it("opens the sources screen from the start screen", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Where the numbers come from" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Where the numbers come from");
  });

  it("shows the birth screen with the country, household and parents in words (CHAR-001)", async () => {
    const { user } = setup();
    await begin(user);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/You are born in /);
    expect(heading).toHaveFocus();
    expect(screen.getByText(/Of all the households in .*, yours is in the .*tenth/)).toBeInTheDocument();
    expect(screen.getByText(/Your mother, .*, is \d+\. Your father, .*, is \d+\./)).toBeInTheDocument();
    expect(screen.getByText(/You are .*, a (girl|boy)\./)).toBeInTheDocument();
    expect(screen.getByText(/^Life test-seed$/)).toBeInTheDocument();
    expect(screen.getByText(/Your family lives in (the countryside|a town or city)\./)).toBeInTheDocument();
    expect(heading).toHaveTextContent(/Born in \d{4}/);
  });

  it("keeps focus on the begin button while loading and after a load error", async () => {
    let fail: (error: Error) => void = () => {};
    const failing = { ...testWorld(), loadIndex: () => new Promise<never>((_, reject) => (fail = reject)) };
    const store = createGameStore(() => "test-seed", failing);
    render(<App store={store} />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Begin a life" });
    await user.click(button);
    expect(screen.getByText("Finding where you are born…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Begin a life" })).toHaveFocus();
    fail(new Error("offline"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Begin a life" })).toHaveFocus();
  });

  it("begins the first year at age 0 and moves focus to the new heading", async () => {
    const { user } = setup();
    await startLife(user);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Age 0");
    expect(heading).toHaveFocus();
  });

  it("shows the four stats as meters and the family", async () => {
    const { user } = setup();
    await startLife(user);
    for (const name of ["Health", "Happiness", "Belonging", "Skills"]) {
      expect(screen.getByRole("meter", { name: new RegExp(`^${name} \\d+, `) })).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: "Family" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/your mother, [23]\d/)).toBeInTheDocument();
  });

  it("shows the school, money and family panels and lets the player compare with US prices (MONEY-007)", async () => {
    const { user } = setup();
    await startLife(user);
    expect(screen.getByRole("tabpanel", { name: "School & work" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Family" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Money" }));
    expect(screen.getByRole("tabpanel", { name: "Money" })).toBeInTheDocument();
    expect(screen.queryByText(/buys what the same amount buys in the United States/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Compare with US prices" }));
    expect(screen.getByText(/buys what the same amount buys in the United States/)).toBeInTheDocument();
    await nextYear(user);
    expect(screen.getByRole("switch", { name: "Compare with US prices" })).toBeChecked();
  });

  it("announces a new life stage after three years", async () => {
    const { user, store } = setup({ pace: "every-year" });
    await startLife(user);
    for (let i = 0; i < 3 && store.getSnapshot().life?.person.alive; i++) await nextYear(user);
    if (store.getSnapshot().life?.person.alive) {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Age 3");
      expect(screen.getByRole("status")).toHaveTextContent("A new chapter begins: Childhood.");
    }
  });

  it("keeps the same status region across years so announcements are read", async () => {
    const { user } = setup();
    await startLife(user);
    const status = screen.getByRole("status");
    await nextYear(user);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(/You turn \d+\.|A new chapter begins|A decision is waiting\./);
  });

  it("tells each year's events or says it was quiet", async () => {
    const { user, store } = setup();
    await startLife(user);
    for (let i = 0; i < 6 && store.getSnapshot().life?.person.alive; i++) {
      await nextYear(user);
      // The year as the story shows it (the live region says the same in plain lines).
      const story = within(screen.getByRole("heading", { level: 2, name: "This year" }).parentElement!);
      const quiet = story.queryByText("A quiet year.");
      const items = story.queryAllByRole("listitem");
      expect(Boolean(quiet) !== items.length > 0).toBe(true);
    }
  });

  it("moves focus back to the heading after each year", async () => {
    const { user } = setup();
    await startLife(user);
    await nextYear(user);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("ends a life on the summary screen, which takes focus, and offers another life (DEATH-001, SUM-001)", async () => {
    const { user, store } = setup();
    await startLife(user);
    while (store.getSnapshot().life?.person.alive) await nextYear(user);
    const name = store.getSnapshot().life!.person.name;
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(name);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Continue to the next year" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Begin another life" }));
    await skipReveal(user);
    expect(await screen.findByRole("button", { name: "Begin this life" })).toBeInTheDocument();
  }, 60_000);

  it("lets the life screen use the whole window and every other screen keep the reading width (UI-010)", async () => {
    const { user } = setup();
    const content = () => document.getElementById("content")!;
    expect(content()).toHaveAttribute("data-layout", "reading");
    await begin(user);
    expect(content()).toHaveAttribute("data-layout", "reading");
    await user.click(screen.getByRole("button", { name: "Begin this life" }));
    expect(content()).toHaveAttribute("data-layout", "wide");
    expect(content()).toBe(screen.getByRole("main"));
    await backToStart(user);
    expect(content()).toHaveAttribute("data-layout", "reading");
  });

  it("offers a skip link to the main content", () => {
    setup();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#content");
  });

  it("is playable with the keyboard alone", async () => {
    const { user } = setup();
    // Focus starts on the heading; the header (help link, theme) and the settings come before the main action.
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    await tabTo(user, screen.getByRole("button", { name: "Begin a life" }));
    await user.keyboard("{Enter}");
    // The birth reveal plays; Skip has focus, and Enter on it opens the birth screen (UI-016).
    expect(await screen.findByRole("button", { name: "Skip" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await screen.findByRole("button", { name: "Begin this life" });
    await tabTo(user, screen.getByRole("button", { name: "Begin this life" }));
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Age 0");
  });

  it("goes back to the start screen", async () => {
    const { user } = setup();
    await startLife(user);
    await backToStart(user);
    expect(screen.getByRole("button", { name: "Begin a life" })).toBeInTheDocument();
  });

  describe("a death in the first year", () => {
    it("moves focus to the summary's heading", async () => {
      const store = createGameStore(() => "test-seed", testWorld(deadlyCountry()));
      render(<App store={store} />);
      const user = userEvent.setup();
      await startLife(user);
      await nextYear(user);
      expect(store.getSnapshot().life?.person.alive).toBe(false);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(store.getSnapshot().life!.person.name);
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
      expect(screen.getByText(/^Died at 0, of /)).toBeInTheDocument();
    });
  });
});
