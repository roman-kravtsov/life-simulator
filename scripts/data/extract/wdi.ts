// World Bank World Development Indicators via the public API (WORLD-001): the latest value per country.
// WDI redistributes figures from other publishers (UN, UNICEF, ILO, WHO); the source note says so.
import { readFileSync } from "node:fs";
import type { IncomeGroup } from "../../../src/engine/world/types";
import { download } from "../lib/cache";
import { type Indicators, MIN_YEAR, put, share, sig } from "./types";

const API = "https://api.worldbank.org/v2";

export const WDI_INDICATORS = {
  urban: "SP.URB.TOTL.IN.ZS",
  outOfPocket: "SH.XPD.OOPC.CH.ZS",
  childLabour: "SL.TLF.0714.ZS",
  marriageAgeFemale: "SP.DYN.SMAM.FE",
  marriageAgeMale: "SP.DYN.SMAM.MA",
  childMarriage: "SP.M18.2024.FE.ZS",
} as const;

export const wdiFile = (id: string) => `wdi/${id}.json`;
export const WDI_COUNTRIES_FILE = "wdi/countries.json";

interface Observation {
  countryiso3code: string;
  date: string;
  value: number | null;
}

async function latest(id: string, refresh: boolean): Promise<Map<string, { year: number; value: number }>> {
  const path = await download(
    wdiFile(id),
    `${API}/country/all/indicator/${id}?format=json&mrnev=1&per_page=20000`,
    refresh,
  );
  const body = JSON.parse(readFileSync(path, "utf8")) as [unknown, Observation[] | null];
  const result = new Map<string, { year: number; value: number }>();
  for (const obs of body[1] ?? []) {
    const year = Number(obs.date);
    if (obs.value === null || !obs.countryiso3code || year < MIN_YEAR) continue;
    result.set(obs.countryiso3code, { year, value: obs.value });
  }
  return result;
}

const INCOME: Record<string, IncomeGroup> = { LIC: "low", LMC: "lower-middle", UMC: "upper-middle", HIC: "high" };

export async function extractIncomeGroups(refresh: boolean): Promise<Map<string, IncomeGroup>> {
  const path = await download(WDI_COUNTRIES_FILE, `${API}/country?format=json&per_page=400`, refresh);
  const body = JSON.parse(readFileSync(path, "utf8")) as [unknown, { id: string; incomeLevel: { id: string } }[]];
  const groups = new Map<string, IncomeGroup>();
  for (const c of body[1]) {
    const group = INCOME[c.incomeLevel.id];
    if (group) groups.set(c.id, group);
  }
  return groups;
}

export async function extractWdi(refresh: boolean): Promise<Indicators> {
  const out: Indicators = new Map();
  const ids = WDI_INDICATORS;
  const [urban, oop, labour, marriageF, marriageM, childMarriage] = await Promise.all([
    latest(ids.urban, refresh),
    latest(ids.outOfPocket, refresh),
    latest(ids.childLabour, refresh),
    latest(ids.marriageAgeFemale, refresh),
    latest(ids.marriageAgeMale, refresh),
    latest(ids.childMarriage, refresh),
  ]);
  const src = (year: number, value: unknown) => ({ source: "wdi", year, value });

  for (const [iso3, o] of urban) put(out, iso3, "demography.urbanShare", src(o.year, share(o.value)));
  for (const [iso3, o] of oop) put(out, iso3, "money.healthOutOfPocketShare", src(o.year, share(o.value)));
  for (const [iso3, o] of labour) put(out, iso3, "work.childLabour", src(o.year, share(o.value)));
  for (const [iso3, o] of childMarriage) put(out, iso3, "family.childMarriageBy18", src(o.year, share(o.value)));
  for (const [iso3, f] of marriageF) {
    const m = marriageM.get(iso3);
    if (m)
      put(
        out,
        iso3,
        "family.meanAgeFirstMarriage",
        src(Math.min(f.year, m.year), { female: sig(f.value), male: sig(m.value) }),
      );
  }
  return out;
}
