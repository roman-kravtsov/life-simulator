// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { en } from "../../src/content/strings/en";
import type { EventRecord, HelpTopic, LifeState } from "../../src/engine/types";
import { App } from "../../src/ui/App";
import { LifeScreen } from "../../src/ui/LifeScreen";
import { createGameStore } from "../../src/ui/store";
import { makeCountry, testWorld } from "../fixtures/country";
import { makePerson } from "../fixtures/person";
import { deadlyCountry } from "./fakes";
import { lifeOf, lifeScreenProps, skipReveal } from "./helpers";

const country = makeCountry({ region: "Western Africa" });
const topics: HelpTopic[] = ["suicide", "violence", "abuse", "grief", "addiction", "illness"];

const lastYearOf = (events: EventRecord[]): LifeState => {
  const person = makePerson({ age: 34, stage: "adulthood" });
  return lifeOf(person, {
    history: [{ age: 34, stage: "adulthood", stageChanged: false, stats: person.stats, events }],
  });
};

describe("help resources (UI-012)", () => {
  describe("a link that is always there", () => {
    const talkLink = () => screen.getByRole("link", { name: "Need to talk?" });

    it("is in the header of every screen, opens the directory in a new tab and is reached by keyboard", async () => {
      const user = userEvent.setup();
      const store = createGameStore(() => "test-seed", testWorld(country));
      render(<App store={store} />);
      const check = async () => {
        const link = talkLink();
        expect(link).toHaveAttribute("href", "https://findahelpline.com");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(link).toHaveAccessibleDescription("Free helplines directory. Opens in a new tab.");
        link.focus();
        expect(link).toHaveFocus();
      };

      await check(); // start
      await user.click(screen.getByRole("button", { name: "Where the numbers come from" }));
      await check(); // sources
      await user.click(screen.getByRole("button", { name: "Back" }));
      await user.click(screen.getByRole("button", { name: "Past lives" }));
      await screen.findByRole("heading", { level: 1, name: "Past lives" });
      await check(); // past lives
      await user.click(screen.getByRole("button", { name: "Back to start" }));
      await user.click(screen.getByRole("button", { name: "Begin a life" }));
      await skipReveal(user);
      await screen.findByRole("button", { name: "Begin this life" });
      await check(); // birth
      await user.click(screen.getByRole("button", { name: "Begin this life" }));
      await check(); // life
    });

    it("is on the summary screen of a life that has ended", async () => {
      const user = userEvent.setup();
      const store = createGameStore(() => "test-seed", testWorld(deadlyCountry()));
      render(<App store={store} />);
      await user.click(screen.getByRole("button", { name: "Begin a life" }));
      await skipReveal(user);
      await user.click(await screen.findByRole("button", { name: "Begin this life" }));
      await user.click(screen.getByRole("button", { name: "Continue to the next year" }));
      expect(screen.getByRole("button", { name: "Begin another life" })).toBeInTheDocument();
      expect(talkLink()).toHaveAttribute("href", "https://findahelpline.com");
    });

    it("is the first stop after the skip link, before the game", async () => {
      const user = userEvent.setup();
      render(<App store={createGameStore(() => "test-seed", testWorld(country))} />);
      (document.activeElement as HTMLElement).blur(); // as when the page has just loaded
      await user.tab();
      expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
      await user.tab();
      expect(talkLink()).toHaveFocus();
    });
  });

  describe("after a hard event", () => {
    it.each(topics)("shows the help for %s with the directory link", (topic) => {
      const event: EventRecord = {
        id: `test.${topic}`,
        textKey: "event.midlife.looking_back",
        helpTopic: topic,
        sensitivity: "difficult",
        effects: [],
      };
      render(<LifeScreen {...lifeScreenProps(country, { life: lastYearOf([event]) })} />);
      expect(screen.getByRole("status")).toHaveTextContent(en[`help.${topic}`]!);
      const story = screen.getByRole("heading", { level: 2, name: "This year" }).parentElement!;
      expect(story).toHaveTextContent(en[`help.${topic}`]!);
      const link = within(story).getByRole("link", { name: "findahelpline.com" });
      expect(link).toHaveAttribute("href", "https://findahelpline.com");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });
});
