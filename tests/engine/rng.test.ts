import { describe, expect, it } from "vitest";
import { createRng, stream } from "../../src/engine/rng";

const draw = (rng: { next(): number }, n: number) => Array.from({ length: n }, () => rng.next());

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    expect(draw(createRng("amber-river-4821"), 20)).toEqual(draw(createRng("amber-river-4821"), 20));
  });

  it("produces different sequences for different seeds", () => {
    expect(draw(createRng("amber-river-4821"), 5)).not.toEqual(draw(createRng("amber-river-4822"), 5));
  });

  it("returns numbers in [0, 1)", () => {
    for (const x of draw(createRng("range"), 10_000)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("is roughly uniform", () => {
    const buckets = new Array(10).fill(0);
    for (const x of draw(createRng("uniform"), 100_000)) buckets[Math.floor(x * 10)]++;
    for (const count of buckets) expect(Math.abs(count - 10_000)).toBeLessThan(500);
  });

  it("keeps the sequence pinned across releases", () => {
    // Golden values: if this fails, every saved life would replay differently.
    expect(draw(createRng("birthright"), 3).map((x) => x.toFixed(10))).toMatchInlineSnapshot(`
      [
        "0.0554435342",
        "0.8966066942",
        "0.1496555503",
      ]
    `);
  });
});

describe("Rng helpers", () => {
  it("int returns integers within inclusive bounds", () => {
    const rng = createRng("int");
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const v = rng.int(3, 6);
      expect(Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("chance matches its probability", () => {
    const rng = createRng("chance");
    let hits = 0;
    for (let i = 0; i < 100_000; i++) if (rng.chance(0.3)) hits++;
    expect(hits / 100_000).toBeCloseTo(0.3, 2);
  });

  it("chance(0) never and chance(1) always hits", () => {
    const rng = createRng("edges");
    for (let i = 0; i < 1_000; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it("weighted picks follow the weights", () => {
    const rng = createRng("weighted");
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 60_000; i++) counts[rng.weighted(["a", "b", "c"] as const, [1, 2, 3])]++;
    expect(counts.a / 60_000).toBeCloseTo(1 / 6, 2);
    expect(counts.b / 60_000).toBeCloseTo(2 / 6, 2);
    expect(counts.c / 60_000).toBeCloseTo(3 / 6, 2);
  });

  it("weighted never picks a zero-weight item", () => {
    const rng = createRng("zero");
    for (let i = 0; i < 5_000; i++) expect(rng.weighted(["x", "y"], [0, 1])).toBe("y");
  });

  it("weighted rejects empty or all-zero weights", () => {
    const rng = createRng("bad");
    expect(() => rng.weighted([], [])).toThrow();
    expect(() => rng.weighted(["x"], [0])).toThrow();
  });

  it("weighted rejects negative, NaN or infinite weights", () => {
    const rng = createRng("invalid");
    expect(() => rng.weighted(["a", "b", "c"], [1, -1, 1])).toThrow();
    expect(() => rng.weighted(["a", "b", "c"], [1, Infinity, 1])).toThrow();
    expect(() => rng.weighted(["a", "b"], [1, NaN])).toThrow();
  });

  it("weighted rejects mismatched lengths", () => {
    expect(() => createRng("len").weighted(["a", "b"], [1])).toThrow();
  });
});

describe("stream", () => {
  it("is deterministic for the same seed, name and period", () => {
    expect(draw(stream("s", "mortality", 30), 5)).toEqual(draw(stream("s", "mortality", 30), 5));
  });

  it("differs between stream names, years and quarters", () => {
    const base = draw(stream("s", "mortality", 30), 5);
    expect(draw(stream("s", "events", 30), 5)).not.toEqual(base);
    expect(draw(stream("s", "mortality", 31), 5)).not.toEqual(base);
    expect(draw(stream("s", "mortality", 30, 2), 5)).not.toEqual(base);
  });

  it("is unaffected by how much another stream was used", () => {
    // Adding an event (more draws on "events") must not change mortality rolls.
    const before = draw(stream("s", "mortality", 30), 5);
    const events = stream("s", "events", 30);
    for (let i = 0; i < 100; i++) events.next();
    expect(draw(stream("s", "mortality", 30), 5)).toEqual(before);
  });
});
