import { readFileSync } from "node:fs";
import { advance, newLife } from "../src/engine/life";
const iso = process.argv[2]!;
const c = JSON.parse(readFileSync(`public/data/countries/${iso}.json`, "utf8"));
const d = new Array(10).fill(0); let n = 0; let sum = 0, sq = 0;
for (let i = 0; i < 1200; i++) {
  let s = newLife({ seed: `x-${iso}-${i}`, country: c });
  while (s.person.alive && s.person.age < 35) s = advance(s, { kind: "continue" }, c).state;
  if (s.person.alive) { d[Math.ceil(s.person.money.percentile / 10) - 1]++; n++; sum += s.person.money.percentile; sq += s.person.money.percentile ** 2; }
}
console.log(iso, d.map((x) => (x / n).toFixed(3)).join(" "), "mean", (sum / n).toFixed(1), "sd", Math.sqrt(sq / n - (sum / n) ** 2).toFixed(1));
