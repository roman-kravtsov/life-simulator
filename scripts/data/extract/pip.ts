// World Bank Poverty and Inequality Platform, 100 percentile bins (WORLD-001).
import { download } from "../lib/cache";
import { readCsv } from "../lib/csv";
import { type Indicators, MIN_YEAR, put } from "./types";

export const PIP_FILE = "pip/world_100bin_2021ppp.csv";
const URL = "https://datacatalogfiles.worldbank.org/ddh-published/0063646/DR0090357/world_100bin.csv";

interface Survey {
  welfareType: "income" | "consumption";
  values: number[];
}

export async function extractPip(refresh: boolean): Promise<Indicators> {
  const path = await download(PIP_FILE, URL, refresh);
  // country -> year -> national survey with the 100 daily-welfare values (2021 PPP$)
  const surveys = new Map<string, Map<number, Survey>>();
  for await (const row of readCsv(path)) {
    if (row.reporting_level !== "national") continue;
    const year = Number(row.year);
    if (year < MIN_YEAR) continue;
    const byYear = surveys.get(row.country_code!) ?? new Map<number, Survey>();
    surveys.set(row.country_code!, byYear);
    const survey = byYear.get(year) ?? { welfareType: row.welfare_type as Survey["welfareType"], values: [] };
    byYear.set(year, survey);
    survey.values[Number(row.percentile) - 1] = Math.round(Number(row.avg_welfare) * 1000) / 1000;
  }

  const out: Indicators = new Map();
  for (const [iso3, byYear] of surveys) {
    const complete = [...byYear].filter(
      ([, s]) =>
        s.values.length === 100 && s.values.every((v, i) => Number.isFinite(v) && (i === 0 || v >= s.values[i - 1]!)),
    );
    if (!complete.length) continue;
    const [year, survey] = complete.reduce((a, b) => (b[0] > a[0] ? b : a));
    put(out, iso3, "money.percentiles", { source: "pip", year, value: survey.values });
    put(out, iso3, "money.welfareType", survey.welfareType);
  }
  return out;
}
