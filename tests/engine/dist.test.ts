import { describe, expect, it } from "vitest";
import { normalCdf, normalQuantile } from "../../src/engine/dist";

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
