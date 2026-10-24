// Seeded randomness (design 3.9). The engine never uses the browser random source:
// every roll comes from an Rng so that a seed and a decision log replay a life exactly.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** One item, chosen with probability proportional to its weight. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
}

/** cyrb128: hashes a string into four 32-bit seeds for sfc32. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** sfc32: small, fast, and good enough statistically for a game. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const next = sfc32(...cyrb128(seed));
  // Discard the first outputs: sfc32 needs a few rounds to mix weak seeds.
  for (let i = 0; i < 12; i++) next();

  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    weighted(items, weights) {
      if (items.length === 0 || items.length !== weights.length) {
        throw new Error("weighted() needs one weight per item");
      }
      if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
        throw new Error("weighted() needs finite, non-negative weights");
      }
      const total = weights.reduce((sum, w) => sum + w, 0);
      if (!(total > 0)) throw new Error("weighted() needs a positive total weight");
      let roll = next() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i]!;
        if (roll < 0 && weights[i]! > 0) return items[i]!;
      }
      // Floating-point rounding can leave a sliver: return the last item with weight.
      for (let i = items.length - 1; i >= 0; i--) if (weights[i]! > 0) return items[i]!;
      throw new Error("unreachable");
    },
  };
}

/** Subsystems that draw randomness. Each gets its own stream per period. */
export type StreamName =
  | "birth"
  | "person"
  | "parents"
  | "family"
  | "drift"
  | "labour"
  | "mortality"
  | "cause"
  | "events"
  | "outcomes"
  | "money"
  | "names"
  | "autoplay";

/**
 * An independent random stream for one subsystem in one period (design 3.9).
 * Draws on one stream never shift another, so adding content does not change
 * when someone dies. Quarter is set only in zoomed years.
 */
export function stream(
  seed: string,
  name: StreamName | `event:${string}` | `pool:${string}`,
  year: number,
  quarter?: 1 | 2 | 3 | 4,
): Rng {
  return createRng(`${seed}\u0000${name}\u0000${year}\u0000${quarter ?? 0}`);
}
