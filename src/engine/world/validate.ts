// Validates a country file against the schema's rules (WORLD-002).
// Used by the pipeline before writing files and by tests on every committed file.
import type { CauseMix, Country, CountryIndex, Sourced } from "./types";

const isSourced = (x: unknown): x is Sourced<unknown> =>
  typeof x === "object" && x !== null && "value" in x && "source" in x && "year" in x;

const inUnit = (x: number) => Number.isFinite(x) && x >= 0 && x <= 1;

export function validateCountry(country: Country, sources: CountryIndex["sources"]): string[] {
  const errors: string[] = [];
  const fail = (path: string, message: string) => errors.push(`${country.iso3} ${path}: ${message}`);

  if (!/^[A-Z]{3}$/.test(country.iso3)) fail("iso3", `must be three upper-case letters, got "${country.iso3}"`);
  if (!country.name) fail("name", "is empty");

  // Every sourced value cites a known source and a plausible reference year.
  const walk = (node: unknown, path: string) => {
    if (isSourced(node)) {
      if (!(node.source in sources)) fail(path, `unknown source "${node.source}"`);
      if (!Number.isInteger(node.year) || node.year < 1950 || node.year > 2100)
        fail(path, `implausible year ${node.year}`);
      return;
    }
    if (typeof node === "object" && node !== null && !Array.isArray(node)) {
      for (const [key, child] of Object.entries(node)) walk(child, path ? `${path}.${key}` : key);
    }
  };
  walk(country, "");

  const { demography: d, money: m, education: e, work: w, family: f, health: h } = country;

  for (const sex of ["female", "male"] as const) {
    const qx = d.lifeTable.value[sex];
    const path = `demography.lifeTable.${sex}`;
    if (qx.length !== 101) fail(path, `needs 101 values (ages 0..100), got ${qx.length}`);
    else if (!qx.every(inUnit)) fail(path, "values must be probabilities between 0 and 1");
    else if (qx[100] !== 1) fail(path, `value at age 100 must be 1, got ${qx[100]}`);
  }

  const positive: [string, number][] = [
    ["demography.birthsPerYear", d.birthsPerYear.value],
    ["demography.population", d.population.value],
    ["demography.sexRatioAtBirth", d.sexRatioAtBirth.value],
    ["demography.tfr", d.tfr.value],
    ["demography.meanAgeAtBirth", d.meanAgeAtBirth.value],
  ];
  for (const [path, value] of positive)
    if (!(Number.isFinite(value) && value > 0)) fail(path, `must be positive, got ${value}`);

  const p = m.percentiles.value;
  if (p.length !== 100) fail("money.percentiles", `needs 100 values, got ${p.length}`);
  else if (!p.every((v, i) => Number.isFinite(v) && v >= 0 && (i === 0 || v >= p[i - 1]!)))
    fail("money.percentiles", "values must be non-negative and ascending");

  const shares: [string, number][] = [
    ["demography.urbanShare", d.urbanShare.value],
    ["money.intergenerationalPersistence", m.intergenerationalPersistence.value],
    ["money.healthOutOfPocketShare", m.healthOutOfPocketShare.value],
    ["work.unemployment", w.unemployment.value],
    ["work.informalShare", w.informalShare.value],
    ["work.childLabour", w.childLabour.value],
    ["family.childMarriageBy18", f.childMarriageBy18.value],
  ];
  const bySexShares = {
    "education.primaryCompletion": e.primaryCompletion,
    "education.lowerSecondaryCompletion": e.lowerSecondaryCompletion,
    "education.upperSecondaryCompletion": e.upperSecondaryCompletion,
    "education.tertiaryEnrolment": e.tertiaryEnrolment,
    "education.literacy": e.literacy,
    "work.labourParticipation": w.labourParticipation,
  };
  for (const [path, v] of Object.entries(bySexShares)) {
    shares.push([`${path}.female`, v.value.female], [`${path}.male`, v.value.male]);
  }
  for (const [path, value] of shares) if (!inUnit(value)) fail(path, `must be between 0 and 1, got ${value}`);

  const sectors = w.sectorShares.value;
  if (Math.abs(sectors.agriculture + sectors.industry + sectors.services - 1) > 0.02)
    fail("work.sectorShares", "shares must sum to 1");

  for (const sex of ["female", "male"] as const) {
    const age = f.meanAgeFirstMarriage.value[sex];
    if (!(age >= 12 && age <= 50)) fail(`family.meanAgeFirstMarriage.${sex}`, `implausible age ${age}`);
  }

  validateCauseMix(h.causeMix.value, fail);
  if (!(h.suicideRate.value >= 0)) fail("health.suicideRate", "must not be negative");

  return errors;
}

function validateCauseMix(mix: CauseMix, fail: (path: string, message: string) => void) {
  const { bands } = mix;
  const contiguous =
    bands.length > 0 &&
    bands[0]![0] === 0 &&
    bands.at(-1)![1] === 101 &&
    bands.every(([from, to], i) => from < to && (i === 0 || from === bands[i - 1]![1]));
  if (!contiguous) fail("health.causeMix.bands", "must run from 0 to 101 without gaps or overlaps");

  for (const sex of ["female", "male"] as const) {
    const rows = mix[sex];
    if (rows.length !== bands.length) {
      fail(`health.causeMix.${sex}`, `needs one row per band (${bands.length}), got ${rows.length}`);
      continue;
    }
    rows.forEach((row, i) => {
      const values = Object.values(row);
      const sum = values.reduce((a, b) => a + b, 0);
      if (!values.every(inUnit) || Math.abs(sum - 1) > 0.01)
        fail(`health.causeMix.${sex}`, `band ${i} shares must be between 0 and 1 and sum to 1, got ${sum.toFixed(3)}`);
    });
  }
}
