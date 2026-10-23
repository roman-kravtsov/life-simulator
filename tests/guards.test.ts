import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../src/content/strings/en";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

const unseededRandom = (source: string) => /Math\s*\.\s*random\s*\(/.test(source);
const trackingCode = (source: string) =>
  /google-analytics|googletagmanager|gtag\(|plausible|segment\.com|mixpanel|posthog|sendBeacon/i.test(source);

describe("RNG-005: no unseeded randomness in the engine", () => {
  it("detects Math.random()", () => {
    expect(unseededRandom("const x = Math.random();")).toBe(true);
    expect(unseededRandom("const x = Math . random ( );")).toBe(true);
    expect(unseededRandom("const x = rng.next();")).toBe(false);
  });

  it.each(sourceFiles("src/engine"))("%s does not call Math.random()", (file) => {
    expect(unseededRandom(readFileSync(file, "utf8"))).toBe(false);
  });
});

describe("ANLT-001: no tracking", () => {
  it("detects common tracking code", () => {
    expect(trackingCode("<script src='https://www.googletagmanager.com/gtag/js'>")).toBe(true);
    expect(trackingCode("render(app)")).toBe(false);
  });

  it.each([...sourceFiles("src"), "index.html"])("%s contains no tracking code", (file) => {
    expect(trackingCode(readFileSync(file, "utf8"))).toBe(false);
  });
});

describe("L10N-001: every string key used in the code exists", () => {
  it.each(sourceFiles("src"))("%s", (file) => {
    const keys = [...readFileSync(file, "utf8").matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]!);
    for (const key of keys) expect(en, `missing string "${key}"`).toHaveProperty([key]);
  });
});
