// UN World Population Prospects 2024 (WORLD-001): country list, births, population, fertility and life tables.
import { download } from "../lib/cache";
import { readCsv } from "../lib/csv";
import { type CountryMeta, type Indicators, put, sig } from "./types";

const BASE = "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES";
export const WPP_FILES = {
  indicators: "wpp/WPP2024_Demographic_Indicators_Medium.csv.gz",
  male: "wpp/WPP2024_Life_Table_Complete_Medium_Male_1950-2023.csv.gz",
  female: "wpp/WPP2024_Life_Table_Complete_Medium_Female_1950-2023.csv.gz",
};
/** Latest estimate year in WPP 2024 (later years are projections). */
const YEAR = 2023;

export async function extractWpp(refresh: boolean): Promise<{ meta: CountryMeta[]; indicators: Indicators }> {
  const files = Object.fromEntries(
    await Promise.all(
      Object.entries(WPP_FILES).map(async ([key, name]) => [
        key,
        await download(name, `${BASE}/${name.split("/")[1]}`, refresh),
      ]),
    ),
  ) as Record<keyof typeof WPP_FILES, string>;

  const out: Indicators = new Map();
  const names = new Map<string, string>();
  const countries: { iso3: string; iso2: string; name: string; parent: string }[] = [];

  for await (const row of readCsv(files.indicators)) {
    if (row.Time !== String(YEAR) || row.Variant !== "Medium") continue;
    names.set(row.LocID!, row.Location!);
    if (row.LocTypeName !== "Country/Area" || !row.ISO3_code) continue;
    const iso3 = row.ISO3_code;
    countries.push({ iso3, iso2: row.ISO2_code!, name: row.Location!, parent: row.ParentID! });
    const at = (value: number) => ({ source: "wpp", year: YEAR, value });
    put(out, iso3, "demography.birthsPerYear", at(Math.round(Number(row.Births) * 1000)));
    put(out, iso3, "demography.population", at(Math.round(Number(row.TPopulation1July) * 1000)));
    put(out, iso3, "demography.sexRatioAtBirth", at(sig(Number(row.SRB) / 100)));
    put(out, iso3, "demography.tfr", at(sig(Number(row.TFR))));
    put(out, iso3, "demography.meanAgeAtBirth", at(sig(Number(row.MAC))));
  }

  const lifeTables: Record<"male" | "female", Map<string, number[]>> = { male: new Map(), female: new Map() };
  for (const sex of ["male", "female"] as const) {
    for await (const row of readCsv(files[sex])) {
      if (row.Time !== String(YEAR) || !row.ISO3_code) continue;
      const age = Number(row.AgeGrpStart);
      if (age > 100) continue;
      let qx = lifeTables[sex].get(row.ISO3_code);
      if (!qx) lifeTables[sex].set(row.ISO3_code, (qx = new Array(101).fill(NaN)));
      // WPP's open-ended 100+ group has qx = 1 by definition.
      qx[age] = age === 100 ? 1 : sig(Number(row.qx));
    }
  }
  for (const [iso3, male] of lifeTables.male) {
    const female = lifeTables.female.get(iso3);
    if (!female || male.some(Number.isNaN) || female.some(Number.isNaN)) continue;
    put(out, iso3, "demography.lifeTable", { source: "wpp", year: YEAR, value: { female, male } });
  }

  const meta = countries.map(({ iso3, iso2, name, parent }) => ({
    iso3,
    iso2,
    name,
    region: names.get(parent) ?? "Unknown",
  }));
  return { meta, indicators: out };
}
