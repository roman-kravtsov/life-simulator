// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../../src/ui/App";
import { createGameStore } from "../../src/ui/store";
import { testWorld } from "../fixtures/country";

const setup = () => {
  const store = createGameStore(() => "test-seed", testWorld());
  render(<App store={store} />);
  return { user: userEvent.setup(), store };
};

const begin = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Begin a life" }));
  await screen.findByRole("button", { name: "Begin this life" });
};

const startLife = async (user: ReturnType<typeof userEvent.setup>) => {
  await begin(user);
  await user.click(screen.getByRole("button", { name: "Begin this life" }));
};

const nextYear = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Continue to the next year" }));

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
    expect(screen.getByText(/Your household is among the .* tenth of households/)).toBeInTheDocument();
    expect(screen.getByText(/Your mother, .*, is \d+\. Your father, .*, is \d+\./)).toBeInTheDocument();
    expect(screen.getByText(/You are .*, a (girl|boy)\./)).toBeInTheDocument();
    expect(screen.getByText(/^Life test-seed$/)).toBeInTheDocument();
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
    for (const name of ["Health", "Wellbeing", "Bonds", "Skills"]) {
      expect(screen.getByRole("meter", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Family" })).toBeInTheDocument();
    expect(screen.getByText(/your mother, 2\d|3\d/)).toBeInTheDocument();
  });

  it("announces a new life stage after three years", async () => {
    const { user, store } = setup();
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
    expect(status).toHaveTextContent(/This year|Your life ends/);
  });

  it("tells each year's events or says it was quiet", async () => {
    const { user, store } = setup();
    await startLife(user);
    for (let i = 0; i < 6 && store.getSnapshot().life?.person.alive; i++) {
      await nextYear(user);
      const status = screen.getByRole("status");
      const quiet = within(status).queryByText("A quiet year.");
      const items = within(status).queryAllByRole("listitem");
      expect(Boolean(quiet) !== items.length > 0).toBe(true);
    }
  });

  it("moves focus back to the heading after each year", async () => {
    const { user } = setup();
    await startLife(user);
    await nextYear(user);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("ends a life with the cause of death and offers another life", async () => {
    const { user, store } = setup();
    await startLife(user);
    while (store.getSnapshot().life?.person.alive) await nextYear(user);
    expect(screen.getByRole("status")).toHaveTextContent(/^Your life ends at \d+, of /);
    expect(screen.queryByRole("button", { name: "Continue to the next year" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Begin another life" }));
    expect(await screen.findByRole("button", { name: "Begin this life" })).toBeInTheDocument();
  });

  it("offers a skip link to the main content", () => {
    setup();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#content");
  });

  it("is playable with the keyboard alone", async () => {
    const { user } = setup();
    // Focus starts on the heading, so the next stop is the main action.
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Begin a life" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await screen.findByRole("button", { name: "Begin this life" });
    await user.tab();
    expect(screen.getByRole("button", { name: "Begin this life" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Age 0");
  });

  it("goes back to the start screen", async () => {
    const { user } = setup();
    await startLife(user);
    await user.click(screen.getByRole("button", { name: "Back to start" }));
    expect(screen.getByRole("button", { name: "Begin a life" })).toBeInTheDocument();
  });
});
