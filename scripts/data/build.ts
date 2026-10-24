// One command rebuilds every country file from the source downloads (WORLD-001):
//   npm run data            reuse files already in .cache/data
//   npm run data -- --refresh   download everything again
// Behind a proxy, run with NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { validateCountry } from "../../src/engine/world/validate";
import type { Sourced } from "../../src/engine/world/types";
import { assemble, type RawCountry } from "./assemble";
import { extractGdim } from "./extract/gdim";
import { extractGho } from "./extract/gho";
import { extractIlostat } from "./extract/ilostat";
import { extractPip } from "./extract/pip";
import { extractUis } from "./extract/uis";
import { extractIncomeGroups, extractWdi } from "./extract/wdi";
import { extractWpp } from "./extract/wpp";
import type { Indicators } from "./extract/types";
import { writeReport } from "./report";
import { DATA_VERSION, SOURCE_IDS, sourceInfo } from "./sources";

const OUT = join(process.cwd(), "public", "data");
const MAX_GZIP_BYTES = 15 * 1024;

export async function build(refresh: boolean) {
  console.log("Extracting sources");
  const wpp = await extractWpp(refresh);
  const incomeGroups = await extractIncomeGroups(refresh);
  const extracts: Indicators[] = [
    wpp.indicators,
    await extractPip(refresh),
    await extractWdi(refresh),
    await extractGdim(refresh),
    await extractUis(refresh),
    await extractIlostat(refresh),
    await extractGho(refresh),
  ];

  const raws: RawCountry[] = wpp.meta.map(({ iso3, iso2, name, region }) => {
    const indicators: RawCountry["indicators"] = {};
    for (const extract of extracts) Object.assign(indicators, extract.get(iso3));
    return { iso3, iso2, name, region, incomeGroup: incomeGroups.get(iso3), indicators };
  });

  const sources = Object.fromEntries(SOURCE_IDS.map((id) => [id, sourceInfo(id)]));
  const { countries, index } = assemble(raws, sources, DATA_VERSION);

  // Only list sources the files actually cite.
  const used = new Set<string>(["estimate"]);
  const collect = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;
    if ("source" in node && "year" in node) used.add((node as Sourced<unknown>).source);
    Object.values(node).forEach(collect);
  };
  countries.forEach(collect);
  index.sources = Object.fromEntries(Object.entries(index.sources).filter(([id]) => used.has(id)));

  const errors = countries.flatMap((c) => validateCountry(c, index.sources));
  if (errors.length) throw new Error(`Invalid country data:\n${errors.slice(0, 30).join("\n")}`);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "countries"), { recursive: true });
  let largest = 0;
  for (const country of countries) {
    const json = JSON.stringify(country);
    largest = Math.max(largest, gzipSync(json).length);
    writeFileSync(join(OUT, "countries", `${country.iso3}.json`), json + "\n");
  }
  if (largest > MAX_GZIP_BYTES)
    throw new Error(`A country file is ${largest} bytes gzipped; the limit is ${MAX_GZIP_BYTES}`);
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index) + "\n");
  writeReport(countries, index);

  console.log(
    `Wrote ${countries.length} countries (${readdirSync(join(OUT, "countries")).length} files, largest ${largest} bytes gzipped); ${index.excluded.length} excluded`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build(process.argv.includes("--refresh")).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
