// The balance gate (ADMIN-005, ROADMAP.md Phase B): the agency probe's targets hold over lives born by the
// odds of birth. A change to the focus effects, the money mix or the drift that breaks one of them fails
// here (the probe, with its larger sample, is the authority: a target near its threshold can differ); `npm run probe` has the full report and `docs/agency-probe.md` the committed numbers.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRng } from "../../src/engine/rng";
import { STRATEGIES, balanceChecks, probeStrategies, type LifeSpec } from "../../src/engine/probe";
import { drawBirthCountry } from "../../src/engine/world/birth";
import type { Country, CountryIndex } from "../../src/engine/world/types";

const index = JSON.parse(readFileSync("public/data/index.json", "utf8")) as CountryIndex;
const countries = new Map<string, Country>();
const load = (iso3: string): Country => {
  if (!countries.has(iso3)) {
    countries.set(iso3, JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country);
  }
  return countries.get(iso3)!;
};

const LIVES = 400;
const PLANS = ["default", "shift-learn", "shift-earn", "shift-health", "shift-rest", "all-belonging", "deliberate"];

describe("the balance targets", () => {
  it("hold over lives born by the odds of birth", () => {
    const specs: LifeSpec[] = Array.from({ length: LIVES }, (_, i) => ({
      seed: `balance-${i}`,
      country: load(drawBirthCountry(index, createRng(`balance-country-${i}`)).iso3),
    }));
    const report = probeStrategies(
      specs,
      STRATEGIES.filter((s) => PLANS.includes(s.id)),
    );
    const unmet = balanceChecks(report).filter((c) => !c.pass);
    expect(unmet.map((c) => `${c.target}: ${c.detail}`)).toEqual([]);
  }, 180_000);
});
