import { readFileSync } from "node:fs";
import { calibrateSystems } from "../src/engine/calibration";
const iso = process.argv[2]!;
const lives = Number(process.argv[3] ?? 600);
const c = JSON.parse(readFileSync(`public/data/countries/${iso}.json`, "utf8"));
console.time(iso);
for (const r of calibrateSystems(c, lives, `sys-${iso}`)) console.log(`${Math.abs(r.simulated - r.expected) <= r.tolerance ? "ok  " : "FAIL"} ${r.name.padEnd(62)} ${r.expected.toFixed(3)} vs ${r.simulated.toFixed(3)}`);
console.timeEnd(iso);
