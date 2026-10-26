import { describe, expect, it } from "vitest";
import { stream } from "../../src/engine/rng";
import { drawBirthCountry } from "../../src/engine/world/birth";
import type { CountryIndex, CountryIndexEntry } from "../../src/engine/world/types";
import {
  REVEAL_FIRST_MS,
  REVEAL_LAST_MS,
  REVEAL_REEL_MS,
  revealStops,
  revealTimings,
  revealView,
} from "../../src/ui/reveal";

// SYNTHETIC index: invented countries and births, for tests only.
const entry = (n: number, births: number): CountryIndexEntry => ({
  iso3: `C${n.toString().padStart(2, "0")}`,
  iso2: `K${n}`,
  name: `Land ${n}`,
  region: "Test Region",
  incomeGroup: "lower-middle",
  birthsPerYear: births,
  population: births * 40,
});

const BIRTHS = [
  9_000_000, 4_000_000, 2_000_000, 1_000_000, 800_000, 600_000, 400_000, 300_000, 200_000, 100_000, 50_000, 20_000,
];
const index = (births: readonly number[] = BIRTHS): CountryIndex => ({
  dataVersion: "test",
  countries: births.map((b, i) => entry(i, b)),
  excluded: [],
  sources: {},
});

describe("revealStops", () => {
  const world = index();
  const real = world.countries[3]!;

  it("passes 6 to 10 other countries, never the real one, never twice", () => {
    for (let n = 0; n < 200; n++) {
      const stops = revealStops(`seed-${n}`, world, real);
      expect(stops.length).toBeGreaterThanOrEqual(6);
      expect(stops.length).toBeLessThanOrEqual(10);
      expect(stops.map((s) => s.iso3)).not.toContain(real.iso3);
      expect(new Set(stops.map((s) => s.iso3)).size).toBe(stops.length);
    }
  });

  it("is the same every time for a seed, and differs between seeds", () => {
    expect(revealStops("amber-river-4821", world, real)).toEqual(revealStops("amber-river-4821", world, real));
    const orders = new Set(
      Array.from({ length: 30 }, (_, n) =>
        revealStops(`s${n}`, world, real)
          .map((s) => s.iso3)
          .join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(20);
  });

  it("shows fewer when the world has too few other countries, and none when it has none", () => {
    const small = index([5, 4, 3]);
    expect(revealStops("x", small, small.countries[0]!)).toHaveLength(2);
    const alone = index([5]);
    expect(revealStops("x", alone, alone.countries[0]!)).toEqual([]);
  });

  it("does not depend on, or disturb, the draw of the birth country", () => {
    const before = drawBirthCountry(world, stream("same", "birth", 0)).iso3;
    revealStops("same", world, real);
    expect(drawBirthCountry(world, stream("same", "birth", 0)).iso3).toBe(before);
  });

  it("picks countries by their share of births, not evenly", () => {
    // The first stop is a weighted draw among the others: compare its frequency with the shares.
    const others = world.countries.filter((c) => c.iso3 !== real.iso3);
    const total = others.reduce((sum, c) => sum + c.birthsPerYear, 0);
    const runs = 6000;
    const seen = new Map<string, number>();
    for (let n = 0; n < runs; n++) {
      const first = revealStops(`batch-${n}`, world, real)[0]!;
      seen.set(first.iso3, (seen.get(first.iso3) ?? 0) + 1);
    }
    for (const c of others) {
      const share = c.birthsPerYear / total;
      const observed = (seen.get(c.iso3) ?? 0) / runs;
      expect(Math.abs(observed - share)).toBeLessThan(0.03);
    }
    // The biggest country is far likelier than the smallest: an even pick would make them equal.
    expect(seen.get("C00") ?? 0).toBeGreaterThan((seen.get("C11") ?? 0) * 50);
  });
});

describe("revealTimings", () => {
  it.each([6, 7, 8, 9, 10])("slows from about 340 ms to about 900 ms over %i names", (count) => {
    const { gaps, delays } = revealTimings(count);
    expect(gaps).toHaveLength(count);
    expect(delays).toHaveLength(count);
    expect(gaps[0]).toBeCloseTo(REVEAL_FIRST_MS, -1);
    expect(gaps.at(-1)).toBeCloseTo(REVEAL_LAST_MS, -1);
    for (let i = 1; i < count; i++) expect(gaps[i]!).toBeGreaterThanOrEqual(gaps[i - 1]!);
    // Never more than about three changes a second.
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(REVEAL_FIRST_MS - 1);
  });

  it.each([6, 7, 8])(
    "keeps the whole reel at about 3.6 s for %i names, so the reveal runs about 6 s with its settle",
    (count) => {
      const { gaps, settleAt } = revealTimings(count);
      const reel = gaps.reduce((a, b) => a + b, 0);
      expect(settleAt).toBeCloseTo(reel, 5);
      expect(REVEAL_REEL_MS).toBe(3600);
      expect(reel).toBeGreaterThan(REVEAL_REEL_MS - 50);
      expect(reel).toBeLessThan(REVEAL_REEL_MS + 50);
    },
  );

  it("runs a little over for ten names, which cannot go below the 340 ms floor, and shorter for few", () => {
    const ten = revealTimings(10).settleAt;
    expect(ten).toBeGreaterThanOrEqual(REVEAL_REEL_MS);
    expect(ten).toBeLessThan(REVEAL_REEL_MS + 700);
    expect(revealTimings(3).settleAt).toBeLessThan(REVEAL_REEL_MS);
    expect(revealTimings(0).settleAt).toBe(0);
  });

  it("puts each name's delay at the sum of the gaps before it", () => {
    const { gaps, delays } = revealTimings(7);
    expect(delays[0]).toBe(0);
    for (let i = 1; i < delays.length; i++) expect(delays[i]).toBeCloseTo(delays[i - 1]! + gaps[i - 1]!, 5);
  });
});

describe("revealView", () => {
  const world = index();
  const real = world.countries[1]!;

  it("says 1 in N from the same births as the draw", () => {
    const total = BIRTHS.reduce((a, b) => a + b, 0);
    const view = revealView("seed", world, real);
    expect(view.share).toBe(Math.round(total / real.birthsPerYear));
    expect(view.countries).toBe(world.countries.length);
    expect(view.country).toEqual({ iso2: real.iso2, name: real.name });
    expect(view.stops.every((s) => s.iso2 && s.name)).toBe(true);
  });
});
