// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CountryIndex } from "../../src/engine/world/types";
import { SourcesScreen } from "../../src/ui/SourcesScreen";

// SYNTHETIC index for tests only.
const index: CountryIndex = {
  dataVersion: "test.1",
  countries: [
    { iso3: "AAA", iso2: "DE", name: "Testland", region: "R", incomeGroup: "high", birthsPerYear: 1, population: 1 },
  ],
  excluded: [{ iso3: "BBB", iso2: "FR", name: "Otherland", missing: ["health.causeMix", "incomeGroup"] }],
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
