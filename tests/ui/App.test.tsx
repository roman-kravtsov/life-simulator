// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { newLife } from "../../src/engine/life";
import type { EventRecord, LifeState } from "../../src/engine/types";
import { App } from "../../src/ui/App";
import { LifeScreen } from "../../src/ui/LifeScreen";
import { createGameStore } from "../../src/ui/store";
import { makeCountry, testSources, testWorld } from "../fixtures/country";

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
      expect(screen.getByRole("meter", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Family" })).toBeInTheDocument();
    expect(screen.getByText(/your mother, [23]\d/)).toBeInTheDocument();
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

  describe("the final year and its care", () => {
    const country = makeCountry({ region: "Western Africa" });
    const noop = () => {};
    const renderEnded = (events: EventRecord[], age = 40): LifeState => {
      const base = newLife({ seed: "end", country });
      const life: LifeState = {
        ...base,
        person: { ...base.person, alive: false, age },
        death: { age, cause: "cardiovascular" },
        history: [{ age, stage: "adulthood", stageChanged: false, stats: base.person.stats, events, died: true }],
      };
      render(
        <LifeScreen
          life={life}
          country={country}
          sources={testSources}
          onContinue={noop}
          onAnother={noop}
          onBack={noop}
        />,
      );
      return life;
    };

    it("still tells the events of the year the person died", () => {
      renderEnded([{ id: "e1", textKey: "event.midlife.looking_back", effects: [] }]);
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(/Your life ends at 40/);
      expect(within(status).getByRole("heading", { name: "This year" })).toBeInTheDocument();
      expect(within(status).getByText(/telling a story you have never told/)).toBeInTheDocument();
    });

    it("follows a grief event with a calm pointer to helplines", () => {
      renderEnded([
        { id: "e2", textKey: "event.midlife.looking_back", helpTopic: "grief", sensitivity: "difficult", effects: [] },
      ]);
      expect(screen.getByText(/free, confidential helplines/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "findahelpline.com" })).toHaveAttribute(
        "href",
        "https://findahelpline.com",
      );
    });

    it("shows no help line for events without a help topic", () => {
      renderEnded([{ id: "e3", textKey: "event.midlife.looking_back", effects: [] }]);
      expect(screen.queryByText(/findahelpline/)).not.toBeInTheDocument();
    });

    it("moves focus to the heading after a death at age 0", async () => {
      const deadly = makeCountry({
        region: "Western Africa",
        demography: {
          ...country.demography,
          lifeTable: {
            ...country.demography.lifeTable,
            value: { female: new Array<number>(101).fill(1), male: new Array<number>(101).fill(1) },
          },
        },
      });
      const store = createGameStore(() => "test-seed", testWorld(deadly));
      render(<App store={store} />);
      const user = userEvent.setup();
      await startLife(user);
      await nextYear(user);
      expect(store.getSnapshot().life?.person.alive).toBe(false);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Age 0");
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    });
  });
});
