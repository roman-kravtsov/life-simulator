// A11Y-003: WCAG AA contrast, checked from the style sheets themselves. The tokens of src/styles.css are read for
// the light and the dark theme, and every colour a rule sets for text is tested against the background it sits on:
// the one the same rule sets, or else the page (`--paper`) and the raised surface (`--paper-raised`), which are what
// most text sits on. Colours set for lines and shapes (`fill`, `stroke`, `border-color` on a control, `outline`) are
// held to 3:1, where they carry meaning.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".css") ? [path] : [];
  });
}

type Tokens = Record<string, string>;

/** The custom properties declared in a block of CSS. */
function declared(block: string): Tokens {
  const tokens: Tokens = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[name!] = value!.trim();
  return tokens;
}

/** The text between the braces that follow `selector`, braces inside included (the dark theme sits in a media query). */
function blockOf(css: string, selector: string, from = 0): string {
  const start = css.indexOf(selector, from);
  if (start < 0) throw new Error(`No ${selector} in styles.css`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", start) + 1, i);
  }
  throw new Error(`Unclosed ${selector}`);
}

const styles = readFileSync(join(SRC, "styles.css"), "utf8");
const light = declared(blockOf(styles, ":root {"));
const darkByDevice = declared(blockOf(styles, "@media (prefers-color-scheme: dark)"));
const darkByChoice = declared(blockOf(styles, ':root[data-theme="dark"]'));
const THEMES: Record<string, Tokens> = {
  light,
  "dark (device)": { ...light, ...darkByDevice },
  "dark (chosen)": { ...light, ...darkByChoice },
};

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("the contrast helper", () => {
  it("knows black on white is 21 and a colour on itself is 1", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#7a5c3e", "#7a5c3e")).toBeCloseTo(1, 5);
  });
  it("is the same whichever way round", () => {
    expect(contrast("#2b241d", "#f6f1e7")).toBe(contrast("#f6f1e7", "#2b241d"));
  });
});

/** A token's colour, or null for a value that is not a plain hex colour (a keyword, a gradient, another token). */
const colourOf = (tokens: Tokens, name: string): string | null => {
  const value = tokens[name];
  return value && /^#[0-9a-f]{3,6}$/i.test(value) ? value : null;
};

describe("A11Y-003: the tokens", () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    describe(theme, () => {
      const pair = (fg: string, bg: string) => contrast(colourOf(tokens, fg)!, colourOf(tokens, bg)!);

      it("has the colours the checks need", () => {
        for (const name of [
          "--paper",
          "--paper-raised",
          "--ink",
          "--ink-soft",
          "--accent",
          "--accent-ink",
          "--focus",
        ]) {
          expect(colourOf(tokens, name), name).not.toBeNull();
        }
      });

      it("reads body text at 4.5:1 or better on the page and on the raised surface", () => {
        for (const bg of ["--paper", "--paper-raised"]) {
          expect(pair("--ink", bg), `--ink on ${bg}`).toBeGreaterThanOrEqual(4.5);
          expect(pair("--ink-soft", bg), `--ink-soft on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("reads the label of a primary button at 4.5:1", () => {
        expect(pair("--accent-ink", "--accent")).toBeGreaterThanOrEqual(4.5);
      });

      it("shows the focus ring, and the controls' borders, at 3:1 against the page and the raised surface", () => {
        for (const bg of ["--paper", "--paper-raised"]) {
          expect(pair("--focus", bg), `--focus on ${bg}`).toBeGreaterThanOrEqual(3);
          expect(pair("--ink-soft", bg), `--ink-soft on ${bg}`).toBeGreaterThanOrEqual(3);
        }
      });

      it("shows each ring colour, and the paper drawn over it, at 3:1", () => {
        for (const name of Object.keys(tokens).filter((token) => token.startsWith("--ring-"))) {
          expect(pair(name, "--paper"), `${name} on paper`).toBeGreaterThanOrEqual(3);
        }
      });

      it("shows the marks of the life strip and the invalid border at 3:1", () => {
        expect(pair("--ochre", "--paper")).toBeGreaterThanOrEqual(3);
        expect(pair("--invalid", "--paper")).toBeGreaterThanOrEqual(3);
      });
    });
  }
});

interface Rule {
  file: string;
  selector: string;
  body: string;
}

/** The flat rules of a style sheet (a rule in a media query counts as a rule; the nesting does not matter here). */
function rulesOf(file: string): Rule[] {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  for (const [, selector, body] of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    rules.push({ file: file.replace(`${SRC}/`, ""), selector: selector!.trim().replace(/\s+/g, " "), body: body! });
  }
  return rules;
}

const rules = files(SRC).flatMap(rulesOf);

const tokenIn = (value: string | undefined) => value?.match(/^var\((--[\w-]+)\)/)?.[1];
const property = (body: string, name: string) =>
  body.match(new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+)`))?.[1]?.trim();

/** Token colours that are decoration or a state, not text, and so are not read against the page. */
const NOT_TEXT = new Set<string>([]);

describe("A11Y-003: the colours the style sheets set for text", () => {
  const text = rules
    .map((rule) => ({ rule, fg: tokenIn(property(rule.body, "color")) }))
    .filter((entry): entry is { rule: Rule; fg: string } => entry.fg !== undefined && !NOT_TEXT.has(entry.fg));

  it("finds text colours to check", () => {
    expect(text.length).toBeGreaterThan(20);
  });

  for (const [theme, tokens] of Object.entries(THEMES)) {
    it(`reads at 4.5:1 on its background in the ${theme} theme`, () => {
      const failures: string[] = [];
      for (const { rule, fg } of text) {
        const fgColour = colourOf(tokens, fg);
        if (!fgColour) continue;
        const own = tokenIn(property(rule.body, "background") ?? property(rule.body, "background-color"));
        const backgrounds = own ? [own] : ["--paper", "--paper-raised"];
        for (const bg of backgrounds) {
          const bgColour = colourOf(tokens, bg);
          if (!bgColour) continue;
          const ratio = contrast(fgColour, bgColour);
          if (ratio < 4.5) {
            failures.push(`${rule.file} ${rule.selector}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
          }
        }
      }
      expect(failures).toEqual([]);
    });
  }
});
