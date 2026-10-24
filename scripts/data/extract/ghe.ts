// WHO Global Health Estimates, deaths by cause, age, sex and country (WORLD-001): the cause-of-death mix.
import { download } from "../lib/cache";
import { readWorkbook, type Row } from "../lib/xlsx";
import type { AgeBand, CauseMix } from "../../../src/engine/world/types";
import { type Indicators, put } from "./types";

export const GHE_FILE = "who/ghe2023.xlsx";
const URL =
  "https://cdn.who.int/media/docs/default-source/gho-documents/global-health-estimates/deaths_bycountry_age_sex_2023_2026-10-01e7663d9c-6384-479a-bb37-b58b127e7288.xlsx?sfvrsn=3ede9d95_2";
const YEAR = 2023;

/** Workbook sheets for each age band, [from, to) in years. */
const BANDS: [string, AgeBand][] = [
  ["0-4", [0, 5]],
  ["5-14", [5, 15]],
  ["15-29", [15, 30]],
  ["30-49", [30, 50]],
  ["50-59", [50, 60]],
  ["60-69", [60, 70]],
  ["70+", [70, 101]],
];

/** Our cause ids and the GHE codes (column B of the workbook) that make them up. */
const CAUSES: Record<string, number[]> = {
  infectious: [20],
  respiratoryInfection: [380],
  maternal: [420],
  neonatal: [490],
  nutritional: [540],
  cancer: [610, 790],
  diabetes: [800],
  cardiovascular: [1100],
  chronicRespiratory: [1170],
  digestive: [1210],
  congenital: [1400],
  unintentionalInjury: [1520],
  selfHarm: [1610],
  violence: [1620],
  conflict: [1630],
};
const ALL_CAUSES = 0;
const SEXES = { Females: "female", Males: "male" } as const;

/** Rounded to 4 decimals; "other" absorbs the remainder so each row sums to 1. */
function toShares(deaths: Map<number, number>): Record<string, number> | undefined {
  const total = deaths.get(ALL_CAUSES);
  if (!total || total <= 0) return undefined;
  const shares: Record<string, number> = {};
  let listed = 0;
  for (const [id, codes] of Object.entries(CAUSES)) {
    const n = codes.reduce((sum, code) => sum + (deaths.get(code) ?? 0), 0);
    listed += n;
    const share = Math.round((n / total) * 10_000) / 10_000;
    if (share > 0) shares[id] = share;
  }
  const other = Math.max(0, Math.round((1 - Object.values(shares).reduce((a, b) => a + b, 0)) * 10_000) / 10_000);
  if (other > 0 && listed <= total) shares.other = other;
  return shares;
}

export async function extractGhe(refresh: boolean): Promise<Indicators> {
  const path = await download(GHE_FILE, URL, refresh);
  const workbook = readWorkbook(path);

  // iso3 -> sex -> band index -> shares
  const mixes = new Map<string, Record<"female" | "male", (Record<string, number> | undefined)[]>>();
  BANDS.forEach(([sheet], bandIndex) => {
    const rows: Row[] = workbook.get(sheet) ?? [];
    const header = rows.find((r) => r.G === "ISO-3 Code");
    if (!header) throw new Error(`GHE sheet "${sheet}" has no ISO-3 header row`);
    const columns = Object.entries(header).filter(([col]) => col !== "G");

    // country column -> sex -> GHE code -> thousands of deaths
    const deaths = new Map<string, Record<"female" | "male", Map<number, number>>>();
    for (const row of rows) {
      const sex = SEXES[row.A as keyof typeof SEXES];
      if (!sex || row.B === undefined) continue;
      for (const [col, iso3] of columns) {
        if (row[col] === undefined) continue;
        const entry = deaths.get(iso3) ?? { female: new Map(), male: new Map() };
        deaths.set(iso3, entry);
        entry[sex].set(Number(row.B), Number(row[col]));
      }
    }
    for (const [iso3, bySex] of deaths) {
      const entry = mixes.get(iso3) ?? { female: [], male: [] };
      mixes.set(iso3, entry);
      for (const sex of ["female", "male"] as const) entry[sex][bandIndex] = toShares(bySex[sex]);
    }
  });

  const out: Indicators = new Map();
  for (const [iso3, bySex] of mixes) {
    const complete = (["female", "male"] as const).every(
      (sex) => bySex[sex].length === BANDS.length && bySex[sex].every((band) => band !== undefined),
    );
    if (!complete) continue;
    const value: CauseMix = {
      bands: BANDS.map(([, band]) => band),
      female: bySex.female as Record<string, number>[],
      male: bySex.male as Record<string, number>[],
    };
    put(out, iso3, "health.causeMix", { source: "who-ghe", year: YEAR, value });
  }
  return out;
}
