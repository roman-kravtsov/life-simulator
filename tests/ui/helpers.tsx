// Shared by the component tests of the life screen. Everything here is SYNTHETIC.
import { act, screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { Country } from "../../src/engine/world/types";
import { DEFAULT_SETTINGS, type LifeState, type Person } from "../../src/engine/types";
import type { LifeScreenProps } from "../../src/ui/LifeScreen";
import { testSources } from "../fixtures/country";
import { makePerson } from "../fixtures/person";

export const lifeOf = (person: Person = makePerson(), extra: Partial<LifeState> = {}): LifeState => ({
  seed: "test",
  person,
  history: [],
  settings: DEFAULT_SETTINGS,
  decisions: [],
  ...extra,
});

/** All the props of the life screen, with spies for the actions, for the parts a test does not care about. */
export function lifeScreenProps(
  country: Country,
  overrides: Partial<LifeScreenProps> & { life?: LifeState } = {},
): LifeScreenProps {
  return {
    life: lifeOf(),
    country,
    sources: testSources,
    showUsPrices: false,
    card: null,
    plan: null,
    quietRun: null,
    restored: null,
    problem: null,
    reflection: null,
    statChanges: [],
    onToggleUsPrices: vi.fn(),
    onContinue: vi.fn(),
    onChoose: vi.fn(),
    onJournal: vi.fn(),
    onSettings: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
}

/** Goes back to the start from the life screen, where that action lives in the settings dialog (UI-004). */
export async function backToStart(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Settings" }));
  await user.click(
    within(screen.getByRole("dialog", { name: "Settings" })).getByRole("button", { name: "Back to start" }),
  );
}

/**
 * Ends a CSS animation of an element, which jsdom never runs. React listens for the prefixed name when the page has no
 * AnimationEvent, as in jsdom, and for the plain one in a browser, so both are sent; only one is heard.
 */
export function endAnimation(element: Element) {
  act(() => {
    for (const type of ["animationend", "webkitAnimationEnd"])
      element.dispatchEvent(new Event(type, { bubbles: true }));
  });
}

/** Skips the birth reveal (UI-016) that plays between Begin and the birth screen, where the test is not about it. */
export async function skipReveal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Skip the reveal" }));
}
