import { describe, expect, it } from "vitest";
import { assemble, type RawCountry } from "../../scripts/data/assemble";
import { reportText } from "../../scripts/data/report";
import { makeCountry, testSources } from "../fixtures/country";

describe("WORLD-003: exclusion report", () => {
  it("names each excluded country and what it lacks, and counts estimated values", () => {
    const toRaw = (iso3: string, drop?: string): RawCountry => {
      const c = makeCountry({ iso3 });
      const indicators: RawCountry["indicators"] = {};
      for (const [group, fields] of Object.entries(c)) {
        if (typeof fields !== "object") continue;
        for (const [key, value] of Object.entries(fields))
          indicators[`${group}.${key}` as keyof typeof indicators] = value;
      }
      if (drop) delete indicators[drop as keyof typeof indicators];
      return { iso3, iso2: "AA", name: `Name ${iso3}`, region: "R", incomeGroup: "high", indicators };
    };
    const { countries, index } = assemble(
      [toRaw("AAA"), toRaw("BBB", "work.unemployment"), toRaw("CCC", "health.causeMix")],
      testSources,
      "test",
    );
    const text = reportText(countries, index);
    expect(text).toContain("**2** countries are included and **1** are left out");
    expect(text).toContain("| CCC | Name CCC | health.causeMix |");
    expect(text).toContain("| work.unemployment | 1 | 50% |");
  });
});
