// @vitest-environment jsdom
// The birth reveal (UI-016). jsdom runs no animations, so the end of each one is fired by hand. Everything here is
// SYNTHETIC.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/ui/App";
import { createDisplayStore, DEFAULT_DISPLAY } from "../../src/ui/display";
import { RevealScreen } from "../../src/ui/RevealScreen";
import type { RevealView } from "../../src/ui/reveal";
import { createGameStore } from "../../src/ui/store";
import { testWorldOfMany } from "../fixtures/country";
import { fakePersistence } from "./fakes";
import { endAnimation } from "./helpers";

const view: RevealView = {
  country: { iso2: "T9", name: "Realland" },
  stops: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"].map((name, i) => ({ iso2: `S${i}`, name })),
  share: 40,
  countries: 190,
  opening: false,
};

/** Preferences held in memory, with the motion choice a test wants. */
const displayWith = (motion: "system" | "reduced" | "full" = "system") => {
  const data = new Map<string, string>();
  const store = createDisplayStore(
    () => document.createElement("html"),
    () =>
      ({
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
      }) as unknown as Storage,
  );
  store.set({ ...DEFAULT_DISPLAY, motion });
  return store;
};

const renderReveal = (props: Partial<React.ComponentProps<typeof RevealScreen>> = {}) => {
  const onEnd = vi.fn();
  const utils = render(<RevealScreen view={view} onEnd={onEnd} display={displayWith()} {...props} />);
  return { onEnd, user: userEvent.setup(), ...utils };
};

afterEach(() => vi.unstubAllGlobals());

describe("the reveal screen", () => {
  it("hides the reel from assistive technology and never puts a passing name in a live region", () => {
    const { container } = renderReveal();
    const reel = container.querySelector("[data-reel]")!;
    expect(reel).toHaveAttribute("aria-hidden", "true");
    for (const { name } of view.stops) expect(reel).toHaveTextContent(name);
    // The names that pass, and the real one, are inside the hidden reel and nowhere else.
    for (const status of screen.getAllByRole("status")) {
      for (const { name } of view.stops) expect(status).not.toHaveTextContent(name);
      expect(reel.contains(status)).toBe(false);
    }
    // The one live region is the status line, and it is polite.
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    // And the accessibility tree has none of them: they are only in the hidden reel.
    for (const { name } of view.stops) expect(screen.queryByText(name)).toBeInTheDocument();
    expect(screen.queryByRole("generic", { name: /Alpha/ })).toBeNull();
  });

  it("announces that it is finding the place, then the place once the real name has settled", () => {
    const { container } = renderReveal();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Finding where you are born…");
    expect(status).not.toHaveTextContent("Realland");
    endAnimation(container.querySelector("[data-settle]")!);
    expect(screen.getByRole("status")).toHaveTextContent("You are born in Realland");
    expect(screen.getByRole("status")).not.toHaveTextContent("Finding");
  });

  it("says how likely the place is, in the year's births, once the line is shown", () => {
    renderReveal();
    expect(
      screen.getByText("About 1 in 40 of the year's births in the 190 countries happen here."),
    ).toBeInTheDocument();
  });

  it("puts Skip first among its controls and gives it focus", async () => {
    const { user } = renderReveal();
    const skip = screen.getByRole("button", { name: "Skip" });
    expect(skip).toHaveFocus();
    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("button")).toEqual([skip]);
    await user.tab();
    expect(skip).not.toHaveFocus();
  });

  it("skips with Skip and with Escape", async () => {
    const { onEnd, user } = renderReveal();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onEnd).toHaveBeenCalledTimes(2);
    expect(onEnd).toHaveBeenLastCalledWith();
  });

  it("ends when the last animation, the hold, ends, and not when another one does", () => {
    const { onEnd, container } = renderReveal();
    endAnimation(container.querySelector("[data-settle]")!);
    endAnimation(container.querySelector("[data-rule]")!);
    endAnimation(container.querySelector("[data-reel] span")!);
    expect(onEnd).not.toHaveBeenCalled();
    endAnimation(container.querySelector("[data-hold]")!);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith();
  });

  it("says it is opening, quietly, when the reel is over and the country is not yet loaded", () => {
    const { rerender, onEnd } = renderReveal();
    expect(screen.queryByText("Opening…")).toBeNull();
    rerender(<RevealScreen view={{ ...view, opening: true }} onEnd={onEnd} display={displayWith()} />);
    expect(screen.getByText("Opening…")).toBeInTheDocument();
    expect(within(screen.getByRole("status")).getByText("Opening…")).toBeInTheDocument();
  });

  it("shows no reel under reduced motion, and ends at once with the note about chance", () => {
    const { onEnd, container } = renderReveal({ display: displayWith("reduced") });
    expect(container.querySelector("[data-reel]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    expect(screen.getByText("Opening…")).toBeInTheDocument();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith({ reduced: true });
  });

  it("follows the system's request for reduced motion unless the player chose full motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const system = renderReveal({ display: displayWith("system") });
    expect(system.container.querySelector("[data-reel]")).toBeNull();
    expect(system.onEnd).toHaveBeenCalledWith({ reduced: true });
    system.unmount();
    const full = renderReveal({ display: displayWith("full") });
    expect(full.container.querySelector("[data-reel]")).not.toBeNull();
    expect(full.onEnd).not.toHaveBeenCalled();
  });
});

describe("the reveal in the app", () => {
  const setup = (world = testWorldOfMany(), display = displayWith()) => {
    const fake = fakePersistence();
    const store = createGameStore(() => "reveal-app", world, fake.persistence);
    render(<App store={store} display={display} />);
    return { store, user: userEvent.setup(), world };
  };
  const begin = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("button", { name: "Begin a life" }));

  it("shows the reveal after Begin, then the birth screen, with focus on its heading, when Skip is pressed", async () => {
    const { user } = setup();
    await begin(user);
    await user.click(await screen.findByRole("button", { name: "Skip" }));
    const heading = await screen.findByRole("heading", { level: 1, name: /^You are born in / });
    expect(heading).toHaveFocus();
    expect(screen.queryByText("Where you are born is drawn by chance", { exact: false })).toBeNull();
  });

  it("goes to the birth screen on Escape", async () => {
    const { user } = setup();
    await begin(user);
    await screen.findByRole("button", { name: "Skip" });
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { level: 1, name: /^You are born in / })).toHaveFocus();
  });

  it("goes to the birth screen when the hold animation ends", async () => {
    const { user } = setup();
    await begin(user);
    await screen.findByRole("button", { name: "Skip" });
    endAnimation(document.querySelector("[data-hold]")!);
    expect(await screen.findByRole("button", { name: "Begin this life" })).toBeInTheDocument();
  });

  it("names the real country, the one the life is lived in, in the result", async () => {
    const { user, store } = setup();
    await begin(user);
    await screen.findByRole("button", { name: "Skip" });
    const { country } = store.getSnapshot();
    expect(document.querySelector("[data-settle]")).toHaveTextContent(country!.name);
    endAnimation(document.querySelector("[data-settle]")!);
    expect(screen.getByRole("status")).toHaveTextContent(`You are born in ${country!.name}`);
  });

  it("opens the birth screen once the country has loaded, when Skip came first", async () => {
    const world = testWorldOfMany();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { user } = setup({ ...world, loadCountry: (iso3: string) => gate.then(() => world.loadCountry(iso3)) });
    await begin(user);
    await user.click(await screen.findByRole("button", { name: "Skip" }));
    expect(await screen.findByText("Opening…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Begin this life" })).toBeNull();
    await act(async () => release());
    expect(await screen.findByRole("button", { name: "Begin this life" })).toBeInTheDocument();
  });

  it("shows no reel under reduced motion, and the birth screen says how the country was drawn", async () => {
    const { user } = setup(testWorldOfMany(), displayWith("reduced"));
    await begin(user);
    expect(await screen.findByRole("button", { name: "Begin this life" })).toBeInTheDocument();
    expect(document.querySelector("[data-reel]")).toBeNull();
    expect(
      screen.getByText("Where you are born is drawn by chance, weighted by where children are born each year."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("goes back to the start with the error when the country will not load", async () => {
    const world = testWorldOfMany();
    const { user } = setup({ ...world, loadCountry: () => Promise.reject(new Error("offline")) });
    await begin(user);
    expect(await screen.findByRole("button", { name: "Begin a life" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  });
});
