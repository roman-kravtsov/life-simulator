import { describe, expect, it } from "vitest";
import { SEED_PATTERN, readableSeed } from "../../src/engine/seed";
import { createRng } from "../../src/engine/rng";

describe("readableSeed (RNG-003)", () => {
  it("makes two words and four digits, like amber-river-4821", () => {
    const rng = createRng("seeds");
    for (let i = 0; i < 200; i++) expect(readableSeed(() => rng.next())).toMatch(SEED_PATTERN);
  });
  it("is deterministic for the same random source", () => {
    expect(readableSeed(() => createRng("a").next())).toBe(readableSeed(() => createRng("a").next()));
  });
  it("varies with the random source", () => {
    const rng = createRng("many");
    const seeds = new Set(Array.from({ length: 200 }, () => readableSeed(() => rng.next())));
    expect(seeds.size).toBeGreaterThan(190);
  });
  it("copes with a source that returns the extremes", () => {
    expect(readableSeed(() => 0)).toMatch(SEED_PATTERN);
    expect(readableSeed(() => 0.9999999999)).toMatch(SEED_PATTERN);
  });
});
