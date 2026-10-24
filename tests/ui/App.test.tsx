// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../../src/ui/App";
import { createGameStore } from "../../src/ui/store";

const setup = () => {
  const store = createGameStore(() => "test-seed");
  render(<App store={store} />);
  return { user: userEvent.setup() };
};

describe("App", () => {
  it("shows the title, the content note and a way to begin", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Birthright");
    expect(screen.getByRole("note")).toHaveTextContent(/suicide/);
    expect(screen.getByRole("button", { name: "Begin a life" })).toBeInTheDocument();
  });

  it("begins a life and moves focus to the new heading", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Age 0");
    expect(heading).toHaveFocus();
  });

  it("shows the four stats as meters", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    for (const name of ["Health", "Wellbeing", "Bonds", "Skills"]) {
      expect(screen.getByRole("meter", { name })).toBeInTheDocument();
    }
  });

  it("announces a new life stage after three years", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Age 3");
    expect(screen.getByRole("status")).toHaveTextContent("A new chapter begins: Childhood.");
  });

  it("keeps the same status region across years so announcements are read", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    const status = screen.getByRole("status");
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("You turn 1.");
  });

  it("moves focus back to the heading after each year", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
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
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Age 0");
  });

  it("goes back to the start screen", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Begin a life" }));
    await user.click(screen.getByRole("button", { name: "Back to start" }));
    expect(screen.getByRole("button", { name: "Begin a life" })).toBeInTheDocument();
  });
});
