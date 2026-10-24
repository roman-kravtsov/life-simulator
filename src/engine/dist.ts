import type { Rng } from "./rng";

/** A normally distributed number (Box-Muller). Uses two draws, so the stream stays predictable. */
export function normal(rng: Rng, mean: number, sd: number): number {
  const u = Math.max(rng.next(), Number.MIN_VALUE);
  const v = rng.next();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The standard normal distribution function (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

const QUANTILE_LOW = [
  -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239,
];
const QUANTILE_HIGH = [
  -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572,
];
const QUANTILE_TAIL = [
  -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968,
  2.938163982698783,
];
const QUANTILE_TAIL_HIGH = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];

const horner = (coefficients: readonly number[], x: number) => coefficients.reduce((acc, c) => acc * x + c, 0);

/** The z-score at cumulative probability `p` (Acklam's algorithm, relative error about 1e-9). Clamped away from 0 and 1. */
export function normalQuantile(p: number): number {
  const q = clamp(p, 1e-9, 1 - 1e-9);
  const tail = (u: number) => {
    const r = Math.sqrt(-2 * Math.log(u));
    return horner(QUANTILE_TAIL, r) / horner([...QUANTILE_TAIL_HIGH, 1], r);
  };
  if (q < 0.02425) return tail(q);
  if (q > 1 - 0.02425) return -tail(1 - q);
  const r = q - 0.5;
  const s = r * r;
  return (horner(QUANTILE_LOW, s) * r) / horner([...QUANTILE_HIGH, 1], s);
}

/** A Poisson-distributed count (Knuth's method; fine for the small means the game uses). */
export function poisson(rng: Rng, mean: number): number {
  const limit = Math.exp(-mean);
  let count = 0;
  let product = rng.next();
  while (product > limit) {
    count++;
    product *= rng.next();
  }
  return count;
}
