import type { Rng } from "./rng";

/** A normally distributed number (Box-Muller). Uses two draws, so the stream stays predictable. */
export function normal(rng: Rng, mean: number, sd: number): number {
  const u = Math.max(rng.next(), Number.MIN_VALUE);
  const v = rng.next();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
