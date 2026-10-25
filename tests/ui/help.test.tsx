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
import { lifeOf, lifeScreenProps } from "./helpers";

const country = makeCountry({ region: "Western Africa" });
const topics: HelpTopic[] = ["suicide", "violence", "abuse", "grief", "addiction", "illness"];

const endedLife = (cause: string, events: EventRecord[] = []): LifeState => {
  const person = makePerson({ age: 34, alive: false, stage: "adulthood" });
  return lifeOf(person, {
    death: { age: 34, cause },
    history: [{ age: 34, stage: "adulthood", stageChanged: false, stats: person.stats, events, died: true }],
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
      await user.click(screen.getByRole("button", { name: "Begin a life" }));
      await screen.findByRole("button", { name: "Begin this life" });
      await check(); // birth
      await user.click(screen.getByRole("button", { name: "Begin this life" }));
      await check(); // life
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
      render(<LifeScreen {...lifeScreenProps(country, { life: endedLife("cardiovascular", [event]) })} />);
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(en[`help.${topic}`]!);
      const link = within(status).getByRole("link", { name: "findahelpline.com" });
      expect(link).toHaveAttribute("href", "https://findahelpline.com");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("when a life ends by suicide", () => {
    it("states the death plainly and always shows the help and the link, with nothing else in the year", () => {
      render(<LifeScreen {...lifeScreenProps(country, { life: endedLife("selfHarm") })} />);
      const status = screen.getByRole("status");
      expect(within(status).getByText("Your life ends at 34, of suicide.")).toBeInTheDocument();
      expect(status).toHaveTextContent(en["help.suicide"]!);
      expect(within(status).getByRole("link", { name: "findahelpline.com" })).toHaveAttribute(
        "href",
        "https://findahelpline.com",
      );
    });

    it("shows the help once when the year's own event already carries it", () => {
      const event: EventRecord = {
        id: "test.low",
        textKey: "event.midlife.looking_back",
        helpTopic: "suicide",
        effects: [],
      };
      render(<LifeScreen {...lifeScreenProps(country, { life: endedLife("selfHarm", [event]) })} />);
      expect(screen.getAllByText(en["help.suicide"]!)).toHaveLength(1);
    });

    it("does not show it for other deaths", () => {
      render(<LifeScreen {...lifeScreenProps(country, { life: endedLife("cancer") })} />);
      expect(screen.queryByText(en["help.suicide"]!)).not.toBeInTheDocument();
    });
  });
});
