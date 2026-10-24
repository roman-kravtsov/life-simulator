// UNESCO Institute for Statistics SDG 4 bulk data (WORLD-001): completion, tertiary enrolment and literacy by sex.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { CACHE_DIR, download } from "../lib/cache";
import { readCsv } from "../lib/csv";
import { type Indicators, MIN_YEAR, put, share } from "./types";

export const UIS_FILE = "uis/SDG.zip";
const URL = "https://download.uis.unesco.org/bdds/202509/SDG.zip";

const SERIES: Record<string, string> = {
  "education.primaryCompletion": "CR.1",
  "education.lowerSecondaryCompletion": "CR.2",
  "education.upperSecondaryCompletion": "CR.3",
  "education.tertiaryEnrolment": "GER.5T8",
  "education.literacy": "LR.AG15T99",
};

export async function extractUis(refresh: boolean): Promise<Indicators> {
  const zip = await download(UIS_FILE, URL, refresh);
  const dir = join(CACHE_DIR, "uis");
  const csv = join(dir, "SDG_DATA_NATIONAL.csv");
  if (!existsSync(csv)) {
    mkdirSync(dir, { recursive: true });
    execFileSync("unzip", ["-o", "-q", zip, "SDG_DATA_NATIONAL.csv", "-d", dir]);
  }

  const wanted = new Map<string, { path: string; sex: "female" | "male" }>();
  for (const [path, code] of Object.entries(SERIES)) {
    wanted.set(`${code}.F`, { path, sex: "female" });
    wanted.set(`${code}.M`, { path, sex: "male" });
  }

  // path -> iso3 -> year -> sex -> percent
  const seen = new Map<string, Map<string, Map<number, Partial<Record<"female" | "male", number>>>>>();
  for await (const row of readCsv(csv)) {
    const target = wanted.get(row.INDICATOR_ID!);
    const year = Number(row.YEAR);
    if (!target || year < MIN_YEAR || row.VALUE === "") continue;
    const byCountry = seen.get(target.path) ?? new Map();
    seen.set(target.path, byCountry);
    const byYear = byCountry.get(row.COUNTRY_ID!) ?? new Map();
    byCountry.set(row.COUNTRY_ID!, byYear);
    const sexes = byYear.get(year) ?? {};
    byYear.set(year, sexes);
    sexes[target.sex] = Number(row.VALUE);
  }

  const out: Indicators = new Map();
  for (const [path, byCountry] of seen) {
    for (const [iso3, byYear] of byCountry) {
      // Latest year with both sexes.
      const years = [...byYear].filter(([, s]) => s.female !== undefined && s.male !== undefined);
      if (!years.length) continue;
      const [year, s] = years.reduce((a, b) => (b[0] > a[0] ? b : a));
      put(out, iso3, path, { source: "uis", year, value: { female: share(s.female!), male: share(s.male!) } });
    }
  }
  return out;
}
