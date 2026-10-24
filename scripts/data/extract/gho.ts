// WHO Global Health Observatory OData API (WORLD-001): suicide rate.
import { readFileSync } from "node:fs";
import { download } from "../lib/cache";
import { type Indicators, MIN_YEAR, put, sig } from "./types";

export const GHO_SUICIDE_FILE = "gho/MH_12.json";
const filter = encodeURIComponent("SpatialDimType eq 'COUNTRY' and Dim1 eq 'SEX_BTSX'");
const URL = `https://ghoapi.azureedge.net/api/MH_12?$filter=${filter}`;

/** Age-standardised suicide deaths per 100,000, both sexes, latest year per country. */
export async function extractGho(refresh: boolean): Promise<Indicators> {
  const path = await download(GHO_SUICIDE_FILE, URL, refresh);
  const body = JSON.parse(readFileSync(path, "utf8")) as {
    value: { SpatialDim: string; TimeDim: number; NumericValue: number | null }[];
  };
  const out: Indicators = new Map();
  for (const row of body.value) {
    if (row.NumericValue === null || row.TimeDim < MIN_YEAR) continue;
    const existing = out.get(row.SpatialDim)?.["health.suicideRate"] as { year: number } | undefined;
    if (!existing || row.TimeDim > existing.year)
      put(out, row.SpatialDim, "health.suicideRate", {
        source: "who-gho",
        year: row.TimeDim,
        value: sig(row.NumericValue, 3),
      });
  }
  return out;
}
