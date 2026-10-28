// @vitest-environment jsdom
// The start screen as a title page (UI-002). Everything here is SYNTHETIC.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { en } from "../../src/content/strings/en";
import { DEFAULT_SETTINGS } from "../../src/engine/types";
import { StartScreen, type StartScreenProps } from "../../src/ui/StartScreen";

const props = (overrides: Partial<StartScreenProps> = {}): StartScreenProps => ({
  status: "idle",
  settings: DEFAULT_SETTINGS,
  resume: null,
  deleted: false,
  onSettings: vi.fn(),
  onBegin: vi.fn(),
  onResume: vi.fn(),
  onDiscard: vi.fn(),
  onPast: vi.fn(),
  onOpenSettings: vi.fn(),
  onSources: vi.fn(),
  ...overrides,
});

describe("the start screen (UI-002)", () => {
  it("does not claim the real odds, which cover only the countries in the data (WORLD-014)", () => {
    expect(en["start.intro"]).not.toMatch(/real odds/i);
    expect(en["sources.intro"]).not.toMatch(/every value/i);
  });

  it("puts focus on the title as usual, and leaves it on Begin when a failure comes while the screen is open", () => {
    const { rerender } = render(<StartScreen {...props()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    const begin = screen.getByRole("button", { name: "Begin a life" });
    begin.focus();
    rerender(<StartScreen {...props({ status: "loading" })} />);
    rerender(<StartScreen {...props({ status: "error" })} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(begin).toHaveFocus();
  });

  it("starts on the error, not the title, when the screen opens already in the error state (UI-016)", () => {
    render(<StartScreen {...props({ status: "error" })} />);
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("does not take focus back from Begin when the player tries again", () => {
    const { rerender } = render(<StartScreen {...props({ status: "error" })} />);
    const begin = screen.getByRole("button", { name: "Begin a life" });
    begin.focus();
    rerender(<StartScreen {...props({ status: "loading" })} />);
    expect(begin).toHaveFocus();
  });

  it("is a title page: a picture of growth rings that a screen reader skips, then the title and subtitle", () => {
    render(<StartScreen {...props()} />);
    const main = screen.getByRole("main");
    const emblem = main.querySelector("svg")!;
    expect(emblem).toHaveAttribute("aria-hidden", "true");
    expect(emblem.querySelectorAll("circle").length).toBeGreaterThanOrEqual(5);
    // Drawn with the ring colours by class (tokens with a light and a dark value), never a colour of its own.
    for (const circle of emblem.querySelectorAll("circle")) {
      expect(circle.getAttribute("class")).toMatch(/fill-|pith/);
      expect(circle).not.toHaveAttribute("fill");
    }
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/^Birthright\s*a life simulation$/);
    expect(heading).toHaveFocus();
    // The picture comes before the title.
    expect(emblem.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reads in order: intro, content note, the two settings, then Begin a life", () => {
    render(<StartScreen {...props()} />);
    const main = within(screen.getByRole("main"));
    const order = [
      main.getByText(/You will be born somewhere in the world/),
      main.getByRole("note"),
      main.getByRole("switch", { name: "Softer telling" }),
      main.getByRole("switch", { name: "Skip quiet years" }),
      main.getByRole("button", { name: "Begin a life" }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(main.getByRole("note")).toHaveTextContent(/suicide/);
  });

  it("begins a life in one press after the note, by keyboard too", async () => {
    const user = userEvent.setup();
    const onBegin = vi.fn();
    render(<StartScreen {...props({ onBegin })} />);
    // From the heading: the two switches, then Begin a life.
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Begin a life" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it("offers Past lives, Settings and the sources as quiet buttons", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<StartScreen {...p} />);
    await user.click(screen.getByRole("button", { name: "Past lives" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Where the numbers come from" }));
    expect(p.onPast).toHaveBeenCalledTimes(1);
    expect(p.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(p.onSources).toHaveBeenCalledTimes(1);
    const nav = screen.getByRole("navigation", { name: "More" });
    expect(within(nav).getAllByRole("button")).toHaveLength(3);
  });

  it("no longer calls itself an early preview", () => {
    render(<StartScreen {...props()} />);
    expect(screen.queryByText(/Early preview/)).not.toBeInTheDocument();
    expect(en["start.preview"]).toBeUndefined();
  });

  it("puts a saved life first, with Begin a life kept below the note", () => {
    render(
      <StartScreen
        {...props({
          resume: {
            kind: "offer",
            seed: "s",
            countryIso3: "KEN",
            name: "Amara",
            age: 34,
            country: { iso2: "KE", name: "Kenya" },
          },
        })}
      />,
    );
    const card = screen.getByRole("region", { name: "Continue your life" });
    expect(card).toHaveTextContent("Amara, 34, in Kenya");
    const begin = screen.getByRole("button", { name: "Begin a life" });
    expect(card.compareDocumentPosition(begin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
