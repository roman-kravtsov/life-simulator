// World Bank Global Database on Intergenerational Mobility (WORLD-001): how strongly schooling passes from parents to children.
import { download } from "../lib/cache";
import { readCsv } from "../lib/csv";
import { type Indicators, put, sig } from "./types";

export const GDIM_FILE = "gdim/GDIM_2023_03.csv";
const URL = "https://datacatalogfiles.worldbank.org/ddh-published/0050771/3/DR0065670/GDIM_2023_03.csv";

/** The 1980 birth cohort (the latest in GDIM), parents' average schooling against all children's. */
export async function extractGdim(refresh: boolean): Promise<Indicators> {
  const path = await download(GDIM_FILE, URL, refresh);
  const out: Indicators = new Map();
  for await (const row of readCsv(path)) {
    if (row.cohort !== "1980" || row.parent !== "avg" || row.child !== "all" || row.COR === "") continue;
    const cor = Number(row.COR);
    if (!(cor >= 0 && cor <= 1)) continue;
    const year = Number(row.year);
    const existing = out.get(row.code!)?.["money.intergenerationalPersistence"] as { year: number } | undefined;
    // Several surveys per country: keep the most recent.
    if (!existing || year > existing.year)
      put(out, row.code!, "money.intergenerationalPersistence", { source: "gdim", year, value: sig(cor, 3) });
  }
  return out;
}
