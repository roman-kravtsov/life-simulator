import { describe, expect, it } from "vitest";
import { countryName, formatCompactNumber, formatDate, formatMoney, formatNumber, formatPercent } from "../src/format";

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
