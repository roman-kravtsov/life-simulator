// Runs the agency probe (ADMIN-005) and writes its report: what each focus area and each decision's
// choices change in a life, measured over lives born by the odds of birth.
// Usage: npm run probe -- [--lives 1000] [--decision-lives 300] [--seed probe] [--out docs/agency-probe.md]
import { readFileSync, writeFileSync } from "node:fs";
import { CONTENT_VERSION } from "../src/content/version";
import { createRng } from "../src/engine/rng";
import { drawBirthCountry } from "../src/engine/world/birth";
import { balanceChecks, probeDecisions, probeStrategies, type LifeSpec } from "../src/engine/probe";
import { renderProbeReport } from "../src/engine/probeReport";
import type { Country, CountryIndex } from "../src/engine/world/types";

const args = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : (args[at + 1] ?? fallback);
};
const lives = Number(option("lives", "1000"));
const decisionLives = Number(option("decision-lives", "300"));
const seed = option("seed", "probe");
const out = option("out", "docs/agency-probe.md");

const index = JSON.parse(readFileSync("public/data/index.json", "utf8")) as CountryIndex;
const cache = new Map<string, Country>();
const load = (iso3: string): Country => {
  let country = cache.get(iso3);
  if (!country) {
    country = JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;
    cache.set(iso3, country);
  }
  return country;
};

/** Lives born where the odds of birth put them, the same for every run with the same seed. */
const specs = (count: number, prefix: string): LifeSpec[] =>
  Array.from({ length: count }, (_, i) => {
    const { iso3 } = drawBirthCountry(index, createRng(`${prefix}-country-${i}`));
    return { seed: `${prefix}-${i}`, country: load(iso3) };
  });

const started = Date.now();
console.log(`Playing ${lives} lives under each plan...`);
const strategies = probeStrategies(specs(lives, seed));
console.log(`Playing the decisions in ${decisionLives} lives...`);
const decisions = probeDecisions(specs(decisionLives, `${seed}-decisions`));
const report = renderProbeReport({
  strategies,
  decisions,
  seed,
  decisionLives,
  contentVersion: CONTENT_VERSION,
  dataVersion: index.dataVersion,
});
writeFileSync(out, report);
console.log(`Wrote ${out} in ${Math.round((Date.now() - started) / 1000)} s`);
const unmet = balanceChecks(strategies).filter((c) => !c.pass);
for (const c of unmet) console.log(`Target not met: ${c.target} (${c.detail})`);
process.exit(unmet.length ? 1 : 0);
