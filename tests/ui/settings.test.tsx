// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../../src/ui/App";
import { createGameStore } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";

const country = makeCountry({ region: "Western Africa" });

const setup = () => {
  const store = createGameStore(() => "seed-0", testWorld(country));
  render(<App store={store} />);
  return { store, user: userEvent.setup() };
};

describe("settings (EVENT-006, TIME-002)", () => {
  it("are on the start screen, each with a line that says what it does", () => {
    setup();
    const softer = screen.getByRole("switch", { name: "Softer telling" });
    const quiet = screen.getByRole("switch", { name: "Skip quiet years" });
    expect(softer).not.toBeChecked();
    expect(quiet).toBeChecked();
    expect(softer).toHaveAccessibleDescription(/Leaves out the hardest events/);
    expect(quiet).toHaveAccessibleDescription(/Years with nothing to decide or tell pass in one step/);
  });

  it("start the next life with what the player chose, and are kept across lives", async () => {
    const { store, user } = setup();
    await user.click(screen.getByRole("switch", { name: "Softer telling" }));
    await user.click(screen.getByRole("switch", { name: "Skip quiet years" }));
    expect(store.getSnapshot().settings).toEqual({ softening: true, pace: "every-year" });
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    await screen.findByRole("button", { name: "Begin this life" });
    expect(store.getSnapshot().life?.settings).toEqual({ softening: true, pace: "every-year" });
    await user.click(screen.getByRole("button", { name: "Begin this life" }));
    await user.click(screen.getByRole("button", { name: "Back to start" }));
    expect(screen.getByRole("switch", { name: "Softer telling" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Skip quiet years" })).not.toBeChecked();
  });

  it("can be changed during a life, from the next year on", async () => {
    const { store, user } = setup();
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    await screen.findByRole("button", { name: "Begin this life" });
    await user.click(screen.getByRole("button", { name: "Begin this life" }));
    expect(screen.getByRole("region", { name: "How you want to play" })).toBeInTheDocument();
    const softer = screen.getByRole("switch", { name: "Softer telling" });
    await user.click(softer);
    expect(softer).toBeChecked();
    expect(store.getSnapshot().life?.settings.softening).toBe(true);
    expect(store.getSnapshot().settings.softening).toBe(true);
    // The life's own record changes with it, so replaying it tells the same story.
    await user.click(screen.getByRole("switch", { name: "Skip quiet years" }));
    expect(store.getSnapshot().life?.settings.pace).toBe("every-year");
  });

  it("work with the keyboard", async () => {
    const { store, user } = setup();
    screen.getByRole("switch", { name: "Softer telling" }).focus();
    await user.keyboard(" ");
    expect(store.getSnapshot().settings.softening).toBe(true);
  });
});
