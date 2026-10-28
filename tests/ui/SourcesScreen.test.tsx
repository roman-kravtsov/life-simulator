// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CountryIndex } from "../../src/engine/world/types";
import { SourcesScreen } from "../../src/ui/SourcesScreen";

// SYNTHETIC index for tests only.
const index: CountryIndex = {
  dataVersion: "test.1",
  birthsYear: 2023,
  countries: [
    {
      iso3: "AAA",
      iso2: "DE",
      name: "Testland",
      region: "R",
      incomeGroup: "high",
      birthsPerYear: 9_000_000,
      population: 1,
    },
  ],
  excluded: [
    {
      iso3: "BBB",
      iso2: "FR",
      name: "Otherland",
      missing: ["health.causeMix", "incomeGroup"],
      birthsPerYear: 1_000_000,
    },
  ],
  sources: {
    one: {
      title: "First dataset",
      publisher: "Publisher One",
      url: "https://example.org/one",
      licence: "CC BY 4.0",
      version: "Edition 1",
      accessed: "2026-10-24",
    },
    estimate: {
      title: "Estimate",
      publisher: "Birthright data pipeline",
      url: "https://example.org/estimate",
      licence: "Derived",
      version: "pipeline",
      accessed: "n/a",
    },
  },
};

describe("WORLD-007: sources screen", () => {
  it("lists each source with publisher, licence, edition and access date", async () => {
    render(<SourcesScreen onBack={() => {}} load={() => Promise.resolve(index)} />);
    expect(await screen.findByRole("link", { name: "First dataset" })).toHaveAttribute(
      "href",
      "https://example.org/one",
    );
    expect(screen.getByText("Publisher One")).toBeInTheDocument();
    expect(screen.getByText("CC BY 4.0")).toBeInTheDocument();
    expect(screen.getByText("Edition 1")).toBeInTheDocument();
    expect(screen.getByText("October 24, 2026")).toBeInTheDocument();
    expect(screen.getByText("Data version test.1. 1 countries are included.")).toBeInTheDocument();
  });

  it("does not list the estimate pseudo-source as a publisher but explains estimates", async () => {
    render(<SourcesScreen onBack={() => {}} load={() => Promise.resolve(index)} />);
    await screen.findByRole("link", { name: "First dataset" });
    expect(screen.queryByRole("link", { name: "Estimate" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Estimated values" })).toBeInTheDocument();
  });

  it("explains the excluded countries and what each one lacks", async () => {
    const user = userEvent.setup();
    render(<SourcesScreen onBack={() => {}} load={() => Promise.resolve(index)} />);
    await user.click(await screen.findByText("Show the 1 countries and what is missing"));
    expect(screen.getByText("France: causes of death, income group")).toBeVisible();
  });

  it("states that it is not endorsed by the publishers", async () => {
    render(<SourcesScreen onBack={() => {}} load={() => Promise.resolve(index)} />);
    expect(await screen.findByText(/not endorsed by WHO/)).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    const user = userEvent.setup();
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(index);
    render(<SourcesScreen onBack={() => {}} load={load} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "First dataset" })).toBeInTheDocument();
  });

  it("moves focus to the heading and goes back", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<SourcesScreen onBack={onBack} load={() => Promise.resolve(index)} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe("WORLD-014: how this works", () => {
  const leftOut = /of the world's births/;

  it("explains what comes from the data, what is ours and what is left out, with the share once loaded", async () => {
    render(<SourcesScreen onBack={() => {}} load={() => Promise.resolve(index)} />);
    expect(await screen.findByText(leftOut)).toHaveTextContent(
      "1 of the 2 countries and areas in the UN's list are not in the game, because the sources lack a core figure for them, most often a recent national survey of household income. Together they account for 10.0% of the world's births in 2023, about 1 million of 10 million a year. The largest are France.",
    );
    expect(screen.getByRole("heading", { level: 2, name: "How this works" })).toBeInTheDocument();
    for (const name of ["What comes from the data", "What is ours", "What is left out"]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
    const ours = screen.getByRole("heading", { level: 3, name: "What is ours" }).parentElement!;
    expect(within(ours).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText(/Also not in the game yet: war and displacement/)).toBeInTheDocument();
  });

  it("shows the static text while loading but not the figures", () => {
    render(<SourcesScreen onBack={() => {}} load={() => new Promise(() => {})} />);
    expect(screen.getByRole("heading", { level: 2, name: "How this works" })).toBeInTheDocument();
    expect(screen.getByText(/Birthright is a model of a life/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText(/Also not in the game yet/)).toBeInTheDocument();
    expect(screen.queryByText(leftOut)).not.toBeInTheDocument();
  });

  it("shows the static text after a load error but not the figures", async () => {
    render(<SourcesScreen onBack={() => {}} load={() => Promise.reject(new Error("offline"))} />);
    await screen.findByRole("alert");
    expect(screen.getByRole("heading", { level: 3, name: "What comes from the data" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.queryByText(leftOut)).not.toBeInTheDocument();
  });

  it("leaves out the figures when no country is left out", async () => {
    render(<SourcesScreen onBack={() => {}} load={() => Promise.resolve({ ...index, excluded: [] })} />);
    await screen.findByRole("link", { name: "First dataset" });
    expect(screen.queryByText(leftOut)).not.toBeInTheDocument();
    expect(screen.getByText(/Also not in the game yet/)).toBeInTheDocument();
  });

  it("keeps the headings in order, h1 then h2 then h3", async () => {
    render(<SourcesScreen onBack={() => {}} load={() => Promise.resolve(index)} />);
    await screen.findByText(leftOut);
    const levels = screen.getAllByRole("heading").map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    expect(levels[1]).toBe(2);
    levels.slice(1).forEach((level, i) => expect(level).toBeLessThanOrEqual((levels[i] ?? 0) + 1));
  });
});
