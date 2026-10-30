import { describe, expect, it } from "vitest";
import { SITE_URL } from "../../src/content/site";
import type { LifeSummary } from "../../src/engine/summary";
import { shareFileName, shareText } from "../../src/ui/share";
import { makeCountry } from "../fixtures/country";
import { finishedLife } from "./fakes";

const country = makeCountry({ region: "Western Africa" });
const { summary: base } = finishedLife("share-seed-1", country);

const withChanges = (changes: Partial<LifeSummary> = {}): LifeSummary => ({ ...base, ...changes });

describe("SHARE-001: the share text", () => {
  it("says who, where and when, how long the life was, what shaped it, and where the game is", () => {
    const text = shareText(withChanges());
    expect(text).toContain(`${base.name}: Testland, ${base.birthYear} to ${base.death.year}.`);
    expect(text).toContain(`Died at ${base.death.age}, of `);
    expect(text).toMatch(/In Testland, a (man|woman) can expect to live about \d+ years?\./);
    expect(text).toMatch(/What shaped it: \d+% circumstance, \d+% choice and \d+% chance\./);
    expect(text).toContain(SITE_URL);
    expect(text).toContain(`Seed: ${base.seed}`);
  });

  it("is short: a handful of lines", () => {
    const lines = shareText(withChanges({ epitaph: "She kept the garden." })).split("\n");
    expect(lines.length).toBeLessThanOrEqual(10);
    expect(lines.every((line) => line.length <= 200)).toBe(true);
  });

  it("gives the three shares as whole percentages that add up to 100", () => {
    const text = shareText(withChanges());
    const [circumstance, choice, chance] = [...text.matchAll(/(\d+)% (?:circumstance|choice|chance)/g)].map((m) =>
      Number(m[1]),
    );
    expect(circumstance! + choice! + chance!).toBe(100);
  });

  it.each([
    ["shorter", -12, "12 years shorter"],
    ["similar", 1, "about as long"],
    ["longer", 9, "9 years longer"],
  ] as const)("compares the years lived with the expectancy: %s", (verdict, difference, words) => {
    const text = shareText(
      withChanges({ death: { ...base.death, expectancy: { ...base.death.expectancy, verdict, difference } } }),
    );
    expect(text).toContain(words);
  });

  it("includes the epitaph as a quotation when the player left one, and nothing when they did not", () => {
    expect(shareText(withChanges({ epitaph: "She kept the garden." }))).toContain("“She kept the garden.”");
    expect(shareText(withChanges({ epitaph: undefined }))).not.toContain("“");
  });

  it("does not state a death by suicide as the cause of a shared text", () => {
    const text = shareText(withChanges({ death: { ...base.death, cause: "selfHarm", age: 31 } }));
    expect(text).toContain("Died at 31.");
    expect(text).not.toMatch(/Died at 31, of/);
    expect(text).not.toMatch(/suicide|self-harm/i);
  });

  it("never leaves a placeholder, undefined or NaN in the words, for lives of any kind", () => {
    for (const seed of ["share-a", "share-b", "share-c", "share-d", "share-e", "share-f"]) {
      const text = shareText(finishedLife(seed, country, seed === "share-b" ? "Remembered." : undefined).summary);
      expect(text).not.toMatch(/[{}]|undefined|NaN/);
      expect(text).not.toMatch(/\bbonds?\b/i);
    }
  });

  it("names the file after the seed, with nothing a file system would refuse", () => {
    expect(shareFileName("amber-river-4821")).toBe("birthright-amber-river-4821.png");
    expect(shareFileName("a/b c?")).toBe("birthright-a-b-c.png");
    expect(shareFileName("")).toBe("birthright-life.png");
  });
});
