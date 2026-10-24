import { describe, expect, it } from "vitest";
import {
  capitalise,
  countryName,
  formatCompactNumber,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  incomeBand,
  pluralKey,
} from "../src/format";

describe("L10N-003: number formatting", () => {
  it("groups digits by locale", () => {
    expect(formatNumber(1234567.8, "en")).toBe("1,234,568");
    expect(formatNumber(1234567.8, "de")).toBe("1.234.568");
    expect(formatNumber(3.14159, "en", { maximumFractionDigits: 2 })).toBe("3.14");
  });

  it("formats shares as percentages", () => {
    expect(formatPercent(0.256, "en")).toBe("26%");
    expect(formatPercent(0.256, "en", 1)).toBe("25.6%");
    expect(formatPercent(0.256, "de")).toBe("26\u00a0%");
  });

  it("shortens large counts", () => {
    expect(formatCompactNumber(134_000_000, "en")).toBe("134 million");
    expect(formatCompactNumber(980, "en")).toBe("980");
  });

  it("formats money in dollars, with cents only for small amounts", () => {
    expect(formatMoney(2.15, "en")).toBe("$2.15");
    expect(formatMoney(47.1, "en")).toBe("$47.10");
    expect(formatMoney(1234.5, "en")).toBe("$1,235");
    expect(formatMoney(2.15, "de")).toBe("2,15\u00a0$");
  });
});

describe("MONEY-007: income bands", () => {
  it("cuts at the international poverty lines (2021 PPP) and the game's own wording thresholds", () => {
    expect(incomeBand(0)).toBe("below-extreme");
    expect(incomeBand(2.99)).toBe("below-extreme");
    expect(incomeBand(3)).toBe("near-extreme");
    expect(incomeBand(4.19)).toBe("near-extreme");
    expect(incomeBand(4.2)).toBe("low");
    expect(incomeBand(8.29)).toBe("low");
    expect(incomeBand(8.3)).toBe("modest");
    expect(incomeBand(19.99)).toBe("modest");
    expect(incomeBand(20)).toBe("comfortable");
    expect(incomeBand(59.99)).toBe("comfortable");
    expect(incomeBand(60)).toBe("wealthy");
    expect(incomeBand(900)).toBe("wealthy");
  });
});

describe("L10N: plural string keys and sentence case", () => {
  it("picks the plural form of a string key for the locale", () => {
    expect(pluralKey("common.years", 1, "en")).toBe("common.years.one");
    expect(pluralKey("common.years", 0, "en")).toBe("common.years.other");
    expect(pluralKey("common.years", 6, "en")).toBe("common.years.other");
  });

  it("capitalises the first letter of a phrase", () => {
    expect(capitalise("a serious injury", "en")).toBe("A serious injury");
    expect(capitalise("", "en")).toBe("");
  });
});

describe("L10N-003: dates", () => {
  it("formats an ISO date in the locale, whatever the time zone", () => {
    expect(formatDate("2026-10-24", "en")).toBe("October 24, 2026");
    expect(formatDate("2026-10-24", "de")).toBe("24. Oktober 2026");
  });
});

describe("L10N-002: country names", () => {
  it("names a country in the requested language", () => {
    expect(countryName({ iso2: "DE", name: "Germany" }, "en")).toBe("Germany");
    expect(countryName({ iso2: "DE", name: "Germany" }, "de")).toBe("Deutschland");
  });

  it("falls back to the source name when the code is unknown", () => {
    expect(countryName({ iso2: "AA", name: "Zedland" }, "en")).toBe("Zedland");
    expect(countryName({ iso2: "", name: "Zedland" }, "en")).toBe("Zedland");
  });
});
