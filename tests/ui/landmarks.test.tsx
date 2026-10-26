// @vitest-environment jsdom
// The page shell (UI-010, A11Y-002): every screen has its header as a banner landmark outside the one main landmark,
// and the skip link leads to that main. Everything here is SYNTHETIC.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/ui/App";
import { ScreenBoundary } from "../../src/ui/ScreenBoundary";
import { createGameStore } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { deadlyCountry, fakePersistence, finishedLife } from "./fakes";
import { backToStart, skipReveal } from "./helpers";

const country = makeCountry({ region: "Western Africa" });

/** One banner and one main, side by side: the banner is not inside the main, and the main is the skip link's target. */
function expectShell(name: string) {
  const banners = screen.getAllByRole("banner");
  const mains = screen.getAllByRole("main");
  expect(banners, name).toHaveLength(1);
  expect(mains, name).toHaveLength(1);
  const [banner, main] = [banners[0]!, mains[0]!];
  expect(banner.tagName, name).toBe("HEADER");
  expect(banner).not.toHaveAttribute("role");
  expect(main.contains(banner), name).toBe(false);
  expect(main, name).toHaveAttribute("id", "content");
  expect(main, name).toHaveAttribute("tabindex", "-1");
  const skip = screen.getByRole("link", { name: "Skip to content" });
  expect(skip).toHaveAttribute("href", `#${main.id}`);
  expect(document.querySelectorAll("#content")).toHaveLength(1);
}

function Throws(): never {
  throw new Error("a stored life this version cannot read");
}

describe("the page shell (UI-010)", () => {
  it("puts the header outside the main on every screen of the loop", async () => {
    const user = userEvent.setup();
    const store = createGameStore(() => "shell-seed", testWorld(deadlyCountry()));
    render(<App store={store} />);
    expectShell("start");
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", "reading");

    await user.click(screen.getByRole("button", { name: "Where the numbers come from" }));
    expectShell("sources");
    await user.click(screen.getByRole("button", { name: "Back" }));

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    expectShell("settings");
    await user.click(screen.getByRole("button", { name: "Back" }));

    await user.click(screen.getByRole("button", { name: "Past lives" }));
    await screen.findByRole("heading", { level: 1, name: "Past lives" });
    expectShell("past lives");
    await user.click(screen.getByRole("button", { name: "Back to start" }));

    await user.click(screen.getByRole("button", { name: "Begin a life" }));

    await skipReveal(user);
    await screen.findByRole("button", { name: "Begin this life" });
    expectShell("birth");
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", "reading");

    await user.click(screen.getByRole("button", { name: "Begin this life" }));
    expectShell("life");
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", "wide");
    // The life screen's own header, with Continue, is the banner.
    expect(screen.getByRole("banner")).toContainElement(
      screen.getByRole("button", { name: "Continue to the next year" }),
    );

    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    await screen.findByRole("button", { name: "Begin another life" });
    expectShell("summary");
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", "reading");
  });

  it("goes back to the reading width when the player leaves the life screen", async () => {
    const user = userEvent.setup();
    render(<App store={createGameStore(() => "shell-seed", testWorld(country))} />);
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    await skipReveal(user);
    await user.click(await screen.findByRole("button", { name: "Begin this life" }));
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", "wide");
    await backToStart(user);
    expectShell("start again");
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", "reading");
  });

  it("keeps the shell when a screen cannot be shown", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <ScreenBoundary onBack={vi.fn()}>
          <Throws />
        </ScreenBoundary>
      </>,
    );
    expectShell("could not show");
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toHaveFocus();
    error.mockRestore();
  });

  it("is there on a past life opened from the archive", async () => {
    const user = userEvent.setup();
    const { past } = finishedLife("archived-seed", country);
    const store = createGameStore(
      () => "x",
      testWorld(country),
      fakePersistence({ status: "none" }, [past]).persistence,
    );
    store.init();
    render(<App store={store} />);
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    await user.click(await screen.findByRole("button", { name: /^Open the life of/ }));
    await screen.findByRole("button", { name: "Begin another life" });
    expectShell("archived summary");
  });

  it("lets the skip link move focus into the main", async () => {
    const user = userEvent.setup();
    render(<App store={createGameStore(() => "shell-seed", testWorld(country))} />);
    (document.activeElement as HTMLElement).blur();
    await user.tab();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveFocus();
    // jsdom does not follow fragment links; the target must be focusable for the browser to move focus there.
    const main = screen.getByRole("main");
    main.focus();
    expect(main).toHaveFocus();
  });
});
