// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { conditionDefs } from "../../src/content/healthConditions";
import { hasString } from "../../src/i18n";
import type { EducationLevel, Person, Relationship } from "../../src/engine/types";
import { LifeScreen } from "../../src/ui/LifeScreen";
import { makeCountry, testSources } from "../fixtures/country";
import { adultAt, makePerson, moneyAt } from "../fixtures/person";

// All people here are SYNTHETIC fixtures. The synthetic income table gives the percentile p
// 1 + (p - 1) * 0.5 dollars a day, so percentile 11 is $6.00.
const country = makeCountry();
const noop = () => {};

function renderLife(overrides: Partial<Person> = {}, options: { showUsPrices?: boolean; onToggle?: () => void } = {}) {
  const person = makePerson(overrides);
  render(
    <LifeScreen
      life={{ seed: "test", person, history: [] }}
      country={country}
      sources={testSources}
      showUsPrices={options.showUsPrices ?? false}
      onToggleUsPrices={options.onToggle ?? noop}
      onContinue={noop}
      onAnother={noop}
      onBack={noop}
    />,
  );
}

const panel = (name: string) => screen.getByRole("region", { name });

const relative = (overrides: Partial<Relationship>): Relationship => ({
  id: "r",
  kind: "sibling",
  name: "Test",
  sex: "female",
  age: 10,
  alive: true,
  closeness: 50,
  ...overrides,
});

describe("life panels", () => {
  it("labels each panel with its own h2 and keeps the one live region", () => {
    renderLife({
      age: 30,
      conditions: [{ id: "malaria", severity: 1, since: 20 }],
      relationships: [relative({ id: "m", kind: "mother", name: "Ama" })],
    });
    for (const name of ["School", "Work", "Money", "Health conditions", "Family"]) {
      expect(within(panel(name)).getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  describe("School (EDU-001, EDU-002)", () => {
    it("says a newborn is too young for school", () => {
      renderLife({ age: 0, stage: "infancy" });
      expect(within(panel("School")).getByText("Too young for school yet.")).toBeInTheDocument();
    });

    it("says which school a child attends and for how long", () => {
      renderLife({ age: 8, education: { level: "none", inSchool: true, years: 2 } });
      const school = within(panel("School"));
      expect(school.getByText("In primary school.")).toBeInTheDocument();
      expect(school.getByText("2 years")).toBeInTheDocument();
      expect(school.queryByText(/read/)).not.toBeInTheDocument();
    });

    it("says which level was finished, and that reading is known from fifteen", () => {
      renderLife({
        age: 40,
        education: { level: "lower-secondary", inSchool: false, years: 9, literate: true },
      });
      const school = within(panel("School"));
      expect(school.getByText("Finished lower secondary school.")).toBeInTheDocument();
      expect(school.getByText("9 years")).toBeInTheDocument();
      expect(school.getByText("You can read and write.")).toBeInTheDocument();
    });

    it("says honestly when someone did not go to school or cannot read", () => {
      renderLife({ age: 40, education: { level: "none", inSchool: false, years: 0, literate: false } });
      const school = within(panel("School"));
      expect(school.getByText("You did not go to school.")).toBeInTheDocument();
      expect(school.getByText("You never learned to read well.")).toBeInTheDocument();
      expect(school.queryByText("Time in school")).not.toBeInTheDocument();
    });

    it("uses the singular for one year", () => {
      renderLife({ age: 7, education: { level: "none", inSchool: true, years: 1 } });
      expect(within(panel("School")).getByText("1 year")).toBeInTheDocument();
    });
  });

  describe("Work (CAREER-001, CAREER-002, CAREER-006)", () => {
    const work = (w: Partial<Person["work"]>): Person["work"] => ({
      status: "child",
      yearsWorked: 0,
      attachment: 0.5,
      ...w,
    });

    it("has no work panel before age six", () => {
      renderLife({ age: 5 });
      expect(screen.queryByRole("region", { name: "Work" })).not.toBeInTheDocument();
    });

    it("says a child is too young for paid work", () => {
      renderLife({ age: 10 });
      expect(within(panel("Work")).getByText("Too young for paid work.")).toBeInTheDocument();
    });

    it("says a teenager out of school is at home", () => {
      renderLife({ age: 16 });
      expect(within(panel("Work")).getByText(/^At home\./)).toBeInTheDocument();
    });

    it("describes formal and informal jobs by sector, with years worked", () => {
      renderLife({ age: 35, work: work({ status: "employed", sector: "industry", formal: true, yearsWorked: 12 }) });
      const formal = within(panel("Work"));
      expect(formal.getByText("Working in industry: steady, formal work.")).toBeInTheDocument();
      expect(formal.getByText("12 years")).toBeInTheDocument();
    });

    it("describes informal work with no contract", () => {
      renderLife({ age: 35, work: work({ status: "informal", sector: "agriculture", formal: false, yearsWorked: 3 }) });
      expect(
        within(panel("Work")).getByText("Working in agriculture: informal work with no contract."),
      ).toBeInTheDocument();
    });

    it.each([
      ["unemployed", "Looking for work and not finding it."],
      ["caregiver", "Looking after the home and the family."],
      ["retired", "Retired."],
    ] as const)("describes %s", (status, text) => {
      renderLife({ age: 50, work: work({ status }) });
      expect(within(panel("Work")).getByText(text)).toBeInTheDocument();
    });
  });

  describe("Money (MONEY-002, MONEY-004, MONEY-007)", () => {
    it("shows the daily and yearly income and what it means in words", () => {
      renderLife(adultAt(11, country));
      const money = within(panel("Money"));
      expect(money.getByText("$6.00")).toBeInTheDocument();
      expect(money.getByText("$2,190")).toBeInTheDocument();
      expect(money.getByText("Very little to spare, and a bad year could undo it")).toBeInTheDocument();
      expect(money.getByText(/international dollars/)).toBeInTheDocument();
    });

    it("names the household while the person is a child, and hides savings and debt", () => {
      renderLife({ age: 10, money: moneyAt(11, { savings: 500, debt: 500 }) });
      const money = within(panel("Money"));
      expect(money.getByText("Each person in your household, a day")).toBeInTheDocument();
      expect(money.queryByText("Savings")).not.toBeInTheDocument();
      expect(money.queryByText(/No savings/)).not.toBeInTheDocument();
    });

    it("says there are no savings and no debts when both are zero", () => {
      renderLife({ age: 30, money: moneyAt(50) });
      expect(within(panel("Money")).getByText("No savings and no debts.")).toBeInTheDocument();
    });

    it("shows savings and debt for an adult", () => {
      renderLife({ age: 30, money: moneyAt(50, { savings: 1234, debt: 80 }) });
      const money = within(panel("Money"));
      expect(money.getByText("$1,234")).toBeInTheDocument();
      expect(money.getByText("$80.00")).toBeInTheDocument();
      expect(money.queryByText("No savings and no debts.")).not.toBeInTheDocument();
    });

    it("hides the comparison with US prices until the switch is on, and the switch reports the press", async () => {
      const onToggle = vi.fn();
      const user = userEvent.setup();
      renderLife({ age: 30 }, { onToggle });
      expect(screen.queryByText(/buys what the same amount buys in the United States/)).not.toBeInTheDocument();
      const toggle = screen.getByRole("switch", { name: "Compare with US prices" });
      expect(toggle).not.toBeChecked();
      await user.tab();
      while (document.activeElement !== toggle) await user.tab();
      await user.keyboard(" ");
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("shows the comparison with US prices when the switch is on", () => {
      renderLife({ age: 30 }, { showUsPrices: true });
      expect(screen.getByRole("switch", { name: "Compare with US prices" })).toBeChecked();
      expect(
        within(panel("Money")).getByText(/an amount here buys what the same amount buys in the United States/),
      ).toBeInTheDocument();
    });
  });

  describe("Health conditions (HEALTH-004)", () => {
    it("is hidden when there are none", () => {
      renderLife({ age: 30 });
      expect(screen.queryByRole("region", { name: "Health conditions" })).not.toBeInTheDocument();
    });

    it("lists conditions with severity in words and the age they began", () => {
      renderLife({
        age: 30,
        conditions: [
          { id: "malaria", severity: 2, since: 7 },
          { id: "serious_injury", severity: 3, since: 25 },
          { id: "congenital_condition", severity: 1, since: 0 },
        ],
      });
      const items = within(panel("Health conditions")).getAllByRole("listitem");
      expect(items.map((item) => item.textContent)).toEqual([
        "Malaria, moderate, since age 7",
        "A serious injury, severe, since age 25",
        "A lasting condition, mild, from birth",
      ]);
    });
  });

  describe("Family (REL-001, FAM-002)", () => {
    const family = [
      relative({ id: "f", kind: "father", name: "Kofi", age: 41, closeness: 62 }),
      relative({ id: "young", name: "Yaw", sex: "male", age: 3, closeness: 85 }),
      relative({ id: "m", kind: "mother", name: "Ama", age: 38, closeness: 15 }),
      relative({ id: "old", name: "Esi", sex: "female", age: 14, closeness: 45 }),
      relative({ id: "gone", name: "Kwame", sex: "male", age: 9, alive: false }),
      relative({ id: "friend", kind: "friend", name: "Abena", age: 11, closeness: 25 }),
    ];

    it("lists parents, then siblings oldest first, then others", () => {
      renderLife({ age: 10, relationships: family });
      const names = within(panel("Family"))
        .getAllByRole("listitem")
        .map((item) => /^[A-Za-z]+/.exec(item.textContent ?? "")?.[0]);
      expect(names).toEqual(["Ama", "Kofi", "Esi", "Kwame", "Yaw", "Abena"]);
    });

    it("counts the living brothers and sisters in a heading line", () => {
      renderLife({ age: 10, relationships: family });
      expect(
        within(panel("Family")).getByRole("heading", { level: 3, name: "You have 2 brothers and sisters" }),
      ).toBeInTheDocument();
    });

    it("uses the singular and the empty form", () => {
      renderLife({ age: 10, relationships: [family[1]!] });
      expect(screen.getByRole("heading", { level: 3, name: "You have 1 brother or sister" })).toBeInTheDocument();
    });

    it("says when there are no siblings", () => {
      renderLife({ age: 10, relationships: [family[0]!] });
      expect(screen.getByRole("heading", { level: 3, name: "You have no brothers or sisters" })).toBeInTheDocument();
    });

    it("names each sibling as a brother or sister, with age", () => {
      renderLife({ age: 10, relationships: family });
      const family_ = within(panel("Family"));
      expect(family_.getByText("Esi, your sister, 14")).toBeInTheDocument();
      expect(family_.getByText("Yaw, your brother, 3")).toBeInTheDocument();
    });

    it("shows closeness in words, with a bar that is only a picture of them", () => {
      renderLife({ age: 10, relationships: family });
      const line = (name: string) => screen.getByText(new RegExp(`^${name},`)).closest("li")!;
      for (const [name, word] of [
        ["Yaw", "very close"],
        ["Ama", "strained"],
        ["Kofi", "close"],
        ["Esi", "friendly"],
        ["Abena", "distant"],
      ] as const) {
        expect(within(line(name)).getByText(word)).toBeInTheDocument();
      }
      const bar = line("Yaw").querySelector("meter")!;
      expect(bar).toHaveAttribute("value", "85");
      expect(bar).toHaveAttribute("aria-hidden", "true");
      expect(within(panel("Family")).queryByRole("meter")).not.toBeInTheDocument();
    });

    it("says there are no living brothers or sisters when only the dead are left", () => {
      renderLife({ age: 10, relationships: [relative({ id: "k", name: "Kwame", alive: false, age: 9 })] });
      expect(
        screen.getByRole("heading", { level: 3, name: "You have no living brothers or sisters" }),
      ).toBeInTheDocument();
    });

    it("keeps the died-at line for the dead and gives them no meter", () => {
      renderLife({ age: 10, relationships: family });
      expect(within(panel("Family")).getByText("Kwame, your brother, died at 9")).toBeInTheDocument();
      expect(screen.getByText("Kwame, your brother, died at 9").closest("li")!.querySelector("meter")).toBeNull();
    });
  });
});

// Keys built from data are not seen by the guard test, so check here that every one exists.
describe("strings built from data", () => {
  const levels: Exclude<EducationLevel, "none">[] = ["primary", "lower-secondary", "upper-secondary", "tertiary"];
  const keys = [
    ...conditionDefs.map((def) => `condition.${def.id}`),
    ...[1, 2, 3].map((n) => `severity.${n}`),
    ...levels.flatMap((l) => [`school.status.attending.${l}`, `school.status.completed.${l}`]),
    ...["literate", "illiterate"].map((k) => `school.reading.${k}`),
    ...["too-young", "at-home", "student", "unemployed", "caregiver", "retired"].map((k) => `work.status.${k}`),
    ...["agriculture", "industry", "services"].map((k) => `work.sector.${k}`),
    ...["below-extreme", "near-extreme", "low", "modest", "comfortable", "wealthy"].map((k) => `money.band.${k}`),
    ...["very-close", "close", "friendly", "distant", "strained"].map((k) => `closeness.${k}`),
    ...["female", "male"].map((k) => `kind.sibling.${k}`),
    ...["one", "other"].flatMap((k) => [`common.years.${k}`, `family.siblings.${k}`]),
    "family.siblings.noneLiving",
  ];

  it.each(keys)("%s exists", (key) => {
    expect(hasString(key)).toBe(true);
  });
});
