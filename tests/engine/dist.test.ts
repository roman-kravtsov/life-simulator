import { describe, expect, it } from "vitest";
import { normalCdf, normalQuantile, poisson } from "../../src/engine/dist";
import { createRng } from "../../src/engine/rng";

describe("normal distribution helpers", () => {
  it("the quantile of 0.5 is 0 and the quantiles are symmetric", () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 6);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 4);
    expect(normalQuantile(0.025)).toBeCloseTo(-1.959964, 4);
    expect(normalQuantile(0.9)).toBeCloseTo(-normalQuantile(0.1), 8);
  });
  it("the cdf inverts the quantile", () => {
    for (const p of [0.001, 0.05, 0.3, 0.5, 0.8, 0.999]) expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 5);
  });
  it("the cdf has the known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1)).toBeCloseTo(0.841345, 5);
    expect(normalCdf(-3)).toBeCloseTo(0.00135, 5);
  });
  it("keeps the extremes finite", () => {
    expect(Number.isFinite(normalQuantile(0))).toBe(true);
    expect(Number.isFinite(normalQuantile(1))).toBe(true);
  });
});

describe("poisson", () => {
  it("has the right mean and variance, and is never negative", () => {
    const rng = createRng("poisson");
    const draws = Array.from({ length: 20000 }, () => poisson(rng, 3.2));
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    const variance = draws.reduce((a, b) => a + (b - mean) ** 2, 0) / draws.length;
    expect(mean).toBeCloseTo(3.2, 1);
    expect(variance).toBeCloseTo(3.2, 0);
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
  });
  it("is zero for a mean of zero", () => {
    expect(poisson(createRng("zero"), 0)).toBe(0);
  });
});
