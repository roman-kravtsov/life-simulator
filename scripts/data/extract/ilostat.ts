// ILOSTAT annual indicators via the ILO bulk API (WORLD-001): participation, unemployment, sectors, informality.
import { download } from "../lib/cache";
import { readCsv } from "../lib/csv";
import { type Indicators, MIN_YEAR, put, share } from "./types";

const API = "https://rplumber.ilo.org/data/indicator/?format=.csv&id=";
export const ILO_IDS = {
  participation: "EAP_DWAP_SEX_AGE_RT_A",
  unemployment: "UNE_DEAP_SEX_AGE_RT_A",
  sectors: "EMP_TEMP_SEX_ECO_NB_A",
  informal: "EMP_NIFL_SEX_RT_A",
} as const;
export const iloFile = (id: string) => `ilo/${id}.csv`;

const ADULTS = "AGE_YTHADULT_YGE15";

/** country -> year -> key -> value, for rows the filter maps to a key. */
async function collect(id: string, refresh: boolean, key: (row: Record<string, string>) => string | undefined) {
  const path = await download(iloFile(id), API + id, refresh);
  const out = new Map<string, Map<number, Record<string, number>>>();
  for await (const row of readCsv(path)) {
    const k = key(row);
    const year = Number(row.time);
    if (k === undefined || year < MIN_YEAR || row.obs_value === "") continue;
    const byYear = out.get(row.ref_area!) ?? new Map();
    out.set(row.ref_area!, byYear);
    const values = byYear.get(year) ?? {};
    byYear.set(year, values);
    values[k] ??= Number(row.obs_value);
  }
  return out;
}

/** The latest year in which every key in `needed` has a value. */
function latestComplete(byYear: Map<number, Record<string, number>>, needed: string[]) {
  const years = [...byYear].filter(([, v]) => needed.every((k) => v[k] !== undefined));
  return years.length ? years.reduce((a, b) => (b[0] > a[0] ? b : a)) : undefined;
}

export async function extractIlostat(refresh: boolean): Promise<Indicators> {
  const out: Indicators = new Map();
  const sex = (row: Record<string, string>) =>
    row.sex === "SEX_F" ? "female" : row.sex === "SEX_M" ? "male" : row.sex === "SEX_T" ? "total" : undefined;

  const participation = await collect(ILO_IDS.participation, refresh, (r) =>
    r.classif1 === ADULTS ? sex(r) : undefined,
  );
  for (const [iso3, byYear] of participation) {
    const found = latestComplete(byYear, ["female", "male"]);
    if (found)
      put(out, iso3, "work.labourParticipation", {
        source: "ilostat",
        year: found[0],
        value: { female: share(found[1].female!), male: share(found[1].male!) },
      });
  }

  const unemployment = await collect(ILO_IDS.unemployment, refresh, (r) =>
    r.classif1 === ADULTS && r.sex === "SEX_T" ? "total" : undefined,
  );
  for (const [iso3, byYear] of unemployment) {
    const found = latestComplete(byYear, ["total"]);
    if (found)
      put(out, iso3, "work.unemployment", { source: "ilostat", year: found[0], value: share(found[1].total!) });
  }

  const sectors = await collect(ILO_IDS.sectors, refresh, (r) =>
    r.sex === "SEX_T"
      ? (
          { ECO_SECTOR_AGR: "agriculture", ECO_SECTOR_IND: "industry", ECO_SECTOR_SER: "services" } as Record<
            string,
            string
          >
        )[r.classif1!]
      : undefined,
  );
  for (const [iso3, byYear] of sectors) {
    const found = latestComplete(byYear, ["agriculture", "industry", "services"]);
    if (!found) continue;
    const { agriculture, industry, services } = found[1] as Record<string, number>;
    const total = agriculture! + industry! + services!;
    if (total <= 0) continue;
    put(out, iso3, "work.sectorShares", {
      source: "ilostat",
      year: found[0],
      value: {
        agriculture: share((agriculture! / total) * 100),
        industry: share((industry! / total) * 100),
        services: share((services! / total) * 100),
      },
    });
  }

  const informal = await collect(ILO_IDS.informal, refresh, (r) => (r.sex === "SEX_T" ? "total" : undefined));
  for (const [iso3, byYear] of informal) {
    const found = latestComplete(byYear, ["total"]);
    if (found)
      put(out, iso3, "work.informalShare", { source: "ilostat", year: found[0], value: share(found[1].total!) });
  }
  return out;
}
