// Runs the calibration harness (SIM-007) for chosen countries and prints the gap to the source data:
// life expectancy first, then the school, work, income and family systems (M4), each with its tolerance.
// Usage: npm run calibrate -- NGA JPN [--lives 5000]
import { readFileSync } from "node:fs";
import { LE_TOLERANCE_YEARS, calibrateLifeExpectancy, calibrateSystems } from "../src/engine/calibration";
import type { Country } from "../src/engine/world/types";

const args = process.argv.slice(2);
const livesAt = args.indexOf("--lives");
const lives = livesAt === -1 ? 3000 : Number(args[livesAt + 1]);
const codes = args.filter((a, i) => !a.startsWith("--") && (livesAt === -1 || i !== livesAt + 1));
if (codes.length === 0)
  throw new Error("Give at least one ISO3 country code, for example: npm run calibrate -- NGA JPN");

let failed = false;
for (const iso3 of codes) {
  const country = JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;
  const { expected, simulated, difference } = calibrateLifeExpectancy(country, lives, `calibrate-${iso3}`);
  const ok = Math.abs(difference) <= LE_TOLERANCE_YEARS;
  failed ||= !ok;
  console.log(
    `${iso3}  life expectancy ${expected.toFixed(1)} (source) vs ${simulated.toFixed(1)} (simulated, ${lives} lives), gap ${difference.toFixed(2)} years  ${ok ? "ok" : "OUT OF TOLERANCE"}`,
  );
  for (const c of calibrateSystems(country, lives, `systems-${iso3}`)) {
    const within = Math.abs(c.simulated - c.expected) <= c.tolerance;
    failed ||= !within;
    console.log(
      `     ${c.name}: ${c.expected.toFixed(3)} (source) vs ${c.simulated.toFixed(3)} (simulated), tolerance ${c.tolerance.toFixed(2)}  ${within ? "ok" : "OUT OF TOLERANCE"}`,
    );
  }
}
process.exit(failed ? 1 : 0);
