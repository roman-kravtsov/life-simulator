// @vitest-environment jsdom
// UI-013: small transitions (the year settling, a card settling, a ring growing). jsdom does not apply style sheets, so
// the markup that the styles hang on is checked here, and the module style sheets are read as text for their rules.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { YearRecord } from "../../src/engine/types";
import { Ledger } from "../../src/ui/Ledger";
import { RingsThumb } from "../../src/ui/RingsThumb";

const rings = (count: number) =>
  Array.from({ length: count }, (_, age) => ({ age, thickness: 0.5, theme: "plain" as const }));

const circles = (container: HTMLElement) => [...container.querySelectorAll("circle")];

describe("UI-013: a ring grows in the thumbnail beside the stats", () => {
  it("marks only the newest, outermost ring when it is asked to grow", () => {
    const { container } = render(<RingsThumb rings={rings(5)} grow />);
    // The outermost ring is drawn first, so it is the first circle.
    const withGrow = circles(container).filter((circle) => circle.hasAttribute("data-newest"));
    expect(circles(container)).toHaveLength(5);
    expect(withGrow).toHaveLength(1);
    expect(circles(container)[0]).toBe(withGrow[0]);
  });

  it("marks none without grow, as on the past lives screen", () => {
    const { container } = render(<RingsThumb rings={rings(5)} />);
    expect(container.querySelectorAll("[data-newest]")).toHaveLength(0);
  });

  it("keeps the same circle when a year is added, so the older rings can ease to their new size", () => {
    const { container, rerender } = render(<RingsThumb rings={rings(4)} grow />);
    const before = circles(container);
    rerender(<RingsThumb rings={rings(5)} grow />);
    const after = circles(container);
    expect(after).toHaveLength(5);
    // Drawn outermost first: the new ring is at the front, the old ones keep their elements behind it.
    expect(after.slice(1)).toEqual(before);
    expect(container.querySelectorAll("[data-newest]")).toHaveLength(1);
    expect(after[0]).toHaveAttribute("data-newest");
  });
});

describe("UI-013: this year settles", () => {
  const earlier: YearRecord[] = [];
  const body = (container: HTMLElement) => container.querySelector("[data-year]") as HTMLElement;

  it("alternates data-year with the age, on the same element", () => {
    const { container, rerender } = render(
      <Ledger age={4} earlier={earlier} tray={null} narrow={false}>
        <h1 tabIndex={-1}>Age 4</h1>
      </Ledger>,
    );
    const node = body(container);
    const heading = container.querySelector("h1")!;
    heading.focus();
    expect(node).toHaveAttribute("data-year", "even");
    rerender(
      <Ledger age={5} earlier={earlier} tray={null} narrow={false}>
        <h1 tabIndex={-1}>Age 5</h1>
      </Ledger>,
    );
    expect(body(container)).toBe(node);
    expect(node).toHaveAttribute("data-year", "odd");
    // Not remounted: the heading keeps focus.
    expect(container.querySelector("h1")).toBe(heading);
    expect(heading).toHaveFocus();
    rerender(
      <Ledger age={6} earlier={earlier} tray={null} narrow={false}>
        <h1 tabIndex={-1}>Age 6</h1>
      </Ledger>,
    );
    expect(body(container)).toBe(node);
    expect(node).toHaveAttribute("data-year", "even");
  });

  it("marks only this year's body, not the earlier ones", () => {
    const past = { age: 3, events: [], text: "A year." } as unknown as YearRecord;
    const { container } = render(
      <Ledger age={4} earlier={[past]} tray={null} narrow={false}>
        <p>Now</p>
      </Ledger>,
    );
    expect(container.querySelectorAll("[data-year]")).toHaveLength(1);
  });
});

describe("UI-013: the motion in the style sheets stays small and gentle", () => {
  const sheets = ["Ledger", "DecisionCardView", "RingsThumb"].map((name) => ({
    name,
    css: readFileSync(join(__dirname, `../../src/ui/${name}.module.css`), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""),
  }));

  /** The names a sheet's `animation` declarations use (not time or easing words). */
  const used = (css: string) =>
    [...css.matchAll(/animation(?:-name)?:\s*([^;]+);/g)].flatMap(([, value]) =>
      value!
        .split(/[\s,]+/)
        .filter(
          (word) =>
            /^[a-z][a-z-]*$/i.test(word) &&
            !/^(ease|ease-out|ease-in|ease-in-out|linear|both|backwards|forwards|none|infinite)$/.test(word),
        ),
    );
  const keyframes = (css: string) => [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)];

  it("defines every animation it uses, in the same file", () => {
    for (const { name, css } of sheets) {
      const names = used(css);
      expect(names.length, name).toBeGreaterThan(0);
      const defined = keyframes(css).map(([, id]) => id);
      for (const id of names) expect(defined, `${name}: ${id}`).toContain(id);
    }
  });

  it("animates the transform only, never opacity, and never repeats", () => {
    for (const { name, css } of sheets) {
      for (const [, id, body] of keyframes(css)) {
        expect(body, `${name}: ${id}`).toMatch(/transform:/);
        expect(body, `${name}: ${id}`).not.toMatch(/opacity/);
      }
      expect(css, name).not.toMatch(/infinite/);
      expect(css, name).not.toMatch(/transition:[^;]*opacity/);
    }
  });
});
