// @vitest-environment jsdom
// The birth screen (UI-003) with the country panel (WORLD-008). Everything here is SYNTHETIC.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Relationship } from "../../src/engine/types";
import type { Country } from "../../src/engine/world/types";
import { BirthScreen } from "../../src/ui/BirthScreen";
import { makeCountry, testSources } from "../fixtures/country";
import { makePerson, moneyAt } from "../fixtures/person";
import { lifeOf } from "./helpers";

const relative = (kind: Relationship["kind"], name: string, age: number): Relationship => ({
  id: `${kind}-${name}`,
  kind,
  name,
  sex: kind === "father" ? "male" : "female",
  age,
  alive: true,
  closeness: 60,
});

const newborn = (siblings: number, percentile = 50) =>
  lifeOf(
    makePerson({
      name: "Ada Obi",
      sex: "female",
      age: 0,
      stage: "infancy",
      location: "rural",
      money: moneyAt(percentile),
      relationships: [
        relative("mother", "Ngozi", 27),
        relative("father", "Emeka", 31),
        ...Array.from({ length: siblings }, (_, i) => relative("sibling", `Sib${i}`, 2 + i)),
      ],
    }),
    { seed: "amber-river-4821" },
  );

function renderBirth(siblings = 0, { country = makeCountry(), percentile = 50 } = {}) {
  const onContinue = vi.fn();
  const onBack = vi.fn();
  render(
    <BirthScreen
      life={newborn(siblings, percentile)}
      country={country}
      sources={testSources}
      onContinue={onContinue}
      onBack={onBack}
    />,
  );
  return { onContinue, onBack, user: userEvent.setup() };
}

describe("the birth screen (UI-003)", () => {
  it("offers a quiet way back to the start after Begin this life, by keyboard too", async () => {
    const { onBack, onContinue, user } = renderBirth();
    const back = screen.getByRole("button", { name: "Back" });
    const begin = screen.getByRole("button", { name: "Begin this life" });
    expect(begin.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    back.focus();
    await user.keyboard("{Enter}");
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("tells the birth in prose, with the heading in focus", () => {
    renderBirth();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^You are born in Testland\s*Born in 2023$/);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(screen.getByText("You are Ada Obi, a girl. Your family lives in the countryside.")).toBeInTheDocument();
    expect(screen.getByText(/^Your mother, Ngozi, is 27\. Your father, Emeka, is 31\./)).toBeInTheDocument();
    expect(screen.getByText("Life amber-river-4821")).toBeInTheDocument();
  });

  it.each([
    [0, "You have no older brothers or sisters."],
    [1, "You have one older brother or sister."],
    [3, "You have 3 older brothers and sisters."],
  ])("says how many older brothers and sisters there are (%i)", (count, line) => {
    renderBirth(count);
    expect(screen.getByText(new RegExp(`${line.replace(/\./g, "\\.")}$`))).toBeInTheDocument();
  });

  it.each([
    [3, "Of all the households in Testland, yours is in the poorest tenth."],
    [45, "Of all the households in Testland, yours is in the tenth just below the middle."],
    [55, "Of all the households in Testland, yours is in the tenth just above the middle."],
    [99, "Of all the households in Testland, yours is in the richest tenth."],
  ])("places the household plainly, for a poor and a rich birth alike (percentile %i)", (percentile, line) => {
    renderBirth(0, { percentile });
    expect(
      screen.getByText(new RegExp(`^${line.replace(/\./g, "\\.")} Each person in it lives on about \\$`)),
    ).toBeInTheDocument();
  });

  it("begins the life from its button, by keyboard", async () => {
    const { onContinue, user } = renderBirth();
    const button = screen.getByRole("button", { name: "Begin this life" });
    for (let i = 0; i < 10 && document.activeElement !== button; i++) await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe("the country panel on the birth screen (WORLD-008)", () => {
  it("is a section headed 'Where you were born', with each fact and its source", () => {
    renderBirth();
    const section = screen.getByRole("region", { name: "Where you were born" });
    expect(within(section).getByRole("heading", { level: 2, name: "Where you were born" })).toBeInTheDocument();
    expect(within(section).getByText("Life expectancy at birth, for women")).toBeInTheDocument();
    expect(within(section).getByText("Women who finish upper secondary school")).toBeInTheDocument();
    expect(within(section).getByText("50%")).toBeInTheDocument();
    expect(
      within(section).getByText("Each person in a middle household, a day (international dollars)"),
    ).toBeInTheDocument();
    expect(within(section).getAllByText("Synthetic test data, 2023")).toHaveLength(3);
  });

  it("leaves out a value the data only estimated", () => {
    const base = makeCountry();
    const country: Country = {
      ...base,
      demography: { ...base.demography, lifeTable: { ...base.demography.lifeTable, estimated: true } },
    };
    renderBirth(0, { country });
    const section = screen.getByRole("region", { name: "Where you were born" });
    expect(within(section).queryByText(/Life expectancy/)).not.toBeInTheDocument();
    expect(within(section).getByText("Women who finish upper secondary school")).toBeInTheDocument();
  });

  it("says so when there is nothing measured to show", () => {
    const base = makeCountry();
    const country: Country = {
      ...base,
      demography: { ...base.demography, lifeTable: { ...base.demography.lifeTable, estimated: true } },
      education: {
        ...base.education,
        upperSecondaryCompletion: { ...base.education.upperSecondaryCompletion, estimated: true },
      },
      money: { ...base.money, percentiles: { ...base.money.percentiles, estimated: true } },
    };
    renderBirth(0, { country });
    const section = screen.getByRole("region", { name: "Where you were born" });
    expect(
      within(section).getByText("The game has no measured figures for this country to show here."),
    ).toBeInTheDocument();
    expect(within(section).queryByRole("term")).not.toBeInTheDocument();
  });
});
