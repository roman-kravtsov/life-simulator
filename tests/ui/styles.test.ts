// The style sheet's side of the display preferences (UI-009, UI-011, A11Y-004, A11Y-005): display.ts puts attributes on
// the root element, and these rules in src/styles.css are what make them count. jsdom does not apply style sheets, so the
// rules are read as text here; e2e/loop.spec.ts checks the computed styles in a real browser.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../../src/styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations of the first rule whose selector list contains `selector` exactly. */
function rule(selector: string, within = css): string {
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const [, selectors, body] of within.matchAll(pattern)) {
    if (
      selectors!
        .split(",")
        .map((part) => part.trim())
        .includes(selector)
    )
      return body!;
  }
  throw new Error(`No rule for ${selector}`);
}

/** The text inside the at-rule block that starts with `prelude`, braces balanced. */
function block(prelude: string): string {
  const start = css.indexOf(prelude);
  if (start < 0) throw new Error(`No ${prelude}`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", start) + 1, i);
  }
  throw new Error(`Unbalanced ${prelude}`);
}

const declares = (body: string, property: string, value: string) =>
  expect(body.replace(/\s+/g, " ")).toMatch(
    new RegExp(`(^|;|\\s)${property}:\\s*${value.replace(/[.()*+]/g, "\\$&")}\\s*(;|$)`),
  );

describe("the style sheet follows the display preferences", () => {
  it("keeps the light and dark themes: the player's choice wins over the system's", () => {
    declares(rule(':root[data-theme="dark"]'), "--paper", "#1c1916");
    declares(rule(':root[data-theme="dark"]'), "color-scheme", "dark");
    declares(
      rule(':root:not([data-theme="light"])', block("@media (prefers-color-scheme: dark)")),
      "color-scheme",
      "dark",
    );
  });

  it("scales the text from the root, on top of the browser's own size", () => {
    declares(rule(':root[data-text-size="large"]'), "font-size", "112.5%");
    declares(rule(':root[data-text-size="larger"]'), "font-size", "125%");
  });

  it("holds back all motion when the player asks, and when the system does unless the player wants it", () => {
    for (const body of [
      rule(':root[data-motion="reduced"] *'),
      rule(':root:not([data-motion="full"]) *', block("@media (prefers-reduced-motion: reduce)")),
    ]) {
      declares(body, "animation", "none !important");
      declares(body, "transition", "none !important");
      declares(body, "scroll-behavior", "auto !important");
    }
    expect(css).toContain(':root[data-motion="reduced"] *::before');
    expect(css).toContain(':root:not([data-motion="full"]) *::after');
  });

  it("is the one place that asks about reduced motion: components animate freely and follow it", () => {
    const dir = join(__dirname, "../../src/ui");
    const sheets = [...readdirSync(dir), ...readdirSync(join(dir, "kit")).map((name) => `kit/${name}`)].filter((name) =>
      name.endsWith(".css"),
    );
    expect(sheets.length).toBeGreaterThan(5);
    for (const name of sheets) {
      expect(readFileSync(join(dir, name), "utf8"), name).not.toMatch(/prefers-reduced-motion/);
    }
  });
});
