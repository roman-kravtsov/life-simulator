/** iso3 -> indicator path (e.g. "work.unemployment") -> value, normally a `Sourced` one. */
export type Indicators = Map<string, Record<string, unknown>>;

export interface CountryMeta {
  iso3: string;
  iso2: string;
  name: string;
  /** UN M49 sub-region name. */
  region: string;
}

export function put(out: Indicators, iso3: string, path: string, value: unknown) {
  let record = out.get(iso3);
  if (!record) out.set(iso3, (record = {}));
  record[path] = value;
}

/** Percent (0..100) to a share (0..1), capped at 1 and rounded to 4 decimals. */
export const share = (percent: number) => Math.round(Math.min(Math.max(percent / 100, 0), 1) * 10_000) / 10_000;

/** Keeps `digits` significant digits so files stay small. */
export const sig = (x: number, digits = 4) => Number(x.toPrecision(digits));

export const MIN_YEAR = 2000;
