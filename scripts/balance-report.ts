// Writes the balance report (ADMIN-003): per country, simulated lives against the source data.
// Usage: npm run balance-report -- [ISO3 ...] [--lives 1000] [--out docs/balance-report.md]
import { readFileSync, writeFileSync } from "node:fs";
import { CONTENT_VERSION } from "../src/content/version";
import { calibrateDeaths, calibrateSystems } from "../src/engine/calibration";
import { isOutside, renderBalanceReport, type CountryBalance } from "../src/engine/balanceReport";
import type { Country, CountryIndex } from "../src/engine/world/types";

/** Countries across regions and income groups, the large ones among them, when none are named. */
const SAMPLE = ["NGA", "ETH", "EGY", "IND", "BGD", "IDN", "CHN", "BRA", "MEX", "DEU", "JPN", "USA"];

const args = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : (args[at + 1] ?? fallback);
};
const lives = Number(option("lives", "1000"));
const out = option("out", "docs/balance-report.md");
const valued = new Set(["--lives", "--out"]);
const named = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1] ?? ""));
const codes = named.length ? named : SAMPLE;

const index = JSON.parse(readFileSync("public/data/index.json", "utf8")) as CountryIndex;
const started = Date.now();
const countries: CountryBalance[] = codes.map((iso3) => {
  console.log(`${iso3}...`);
  const country = JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;
  const { lifeExpectancy, causes } = calibrateDeaths(country, lives, `balance-${iso3}`);
  const systems = calibrateSystems(country, lives, `balance-systems-${iso3}`);
  return { country, lifeExpectancy, comparisons: [...systems, ...causes] };
});
writeFileSync(
  out,
  renderBalanceReport({ countries, lives, contentVersion: CONTENT_VERSION, dataVersion: index.dataVersion }),
);
const outside = countries.reduce((n, c) => n + c.comparisons.filter(isOutside).length, 0);
console.log(`Wrote ${out} in ${Math.round((Date.now() - started) / 1000)} s; ${outside} figures outside tolerance`);
process.exit(args.includes("--strict") && outside > 0 ? 1 : 0);
