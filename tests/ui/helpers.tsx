// Shared by the component tests of the life screen. Everything here is SYNTHETIC.
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
    onToggleUsPrices: vi.fn(),
    onContinue: vi.fn(),
    onChoose: vi.fn(),
    onSettings: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
}
