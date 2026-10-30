// @vitest-environment jsdom
// UI-013: small transitions (the year, with its card, settling; a ring growing). jsdom does not apply style sheets, so
// the markup that the styles hang on is checked here, and the module style sheets are read as text for their rules.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { YearRecord } from "../../src/engine/types";
import { Ledger } from "../../src/ui/Ledger";
import { RingsThumb } from "../../src/ui/RingsThumb";

const rings = (count: number) =>
  Array.from({ length: count }, (_, age) => ({ age, thickness: 0.5, theme: "plain" as const }));

/** React listens for the prefixed name where the DOM has no `animation` style (jsdom), so send the one it listens for. */
const animationEnd = (element: Element) =>
  act(() => {
    for (const type of ["animationend", "webkitAnimationEnd"])
      element.dispatchEvent(new Event(type, { bubbles: true }));
  });

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

describe("UI-013: a ring grows once", () => {
  it("stops marking the ring when its animation ends, and marks the next one when a year is added", () => {
    const { container, rerender } = render(<RingsThumb rings={rings(4)} grow />);
    const newest = () => container.querySelector("[data-newest]");
    animationEnd(newest()!);
    expect(newest()).toBeNull();
    // Shown again (a hidden panel un-hidden) or drawn again with the same rings: nothing grows.
    rerender(<RingsThumb rings={rings(4)} grow />);
    expect(newest()).toBeNull();
    rerender(<RingsThumb rings={rings(5)} grow />);
    expect(circles(container)[0]).toBe(newest());
  });
});

describe("UI-013: this year settles", () => {
  const earlier: YearRecord[] = [];
  const body = (container: HTMLElement) => container.querySelector("h1")!.parentElement as HTMLElement;

  it("settles once for each age, on the same element, even when several years pass at once", () => {
    const ledger = (age: number) => (
      <Ledger age={age} earlier={earlier} tray={null} narrow={false}>
        <h1 tabIndex={-1}>Age {age}</h1>
      </Ledger>
    );
    const { container, rerender } = render(ledger(4));
    const node = body(container);
    const heading = container.querySelector("h1")!;
    heading.focus();
    expect(node).toHaveAttribute("data-settling");
    // A child's animation ending is not the body's.
    animationEnd(heading);
    expect(node).toHaveAttribute("data-settling");
    animationEnd(node);
    expect(node).not.toHaveAttribute("data-settling");
    // Rendered again at the same age (a tab shown again): at rest.
    rerender(ledger(4));
    expect(node).not.toHaveAttribute("data-settling");
    // 4 to 6, a quiet year passed: it settles again all the same.
    rerender(ledger(6));
    expect(node).toHaveAttribute("data-settling");
    animationEnd(node);
    rerender(ledger(7));
    expect(node).toHaveAttribute("data-settling");
    // Not remounted: the heading keeps focus.
    expect(body(container)).toBe(node);
    expect(container.querySelector("h1")).toBe(heading);
    expect(heading).toHaveFocus();
  });

  it("marks only this year's body, not the earlier ones", () => {
    const past = { age: 3, events: [], text: "A year." } as unknown as YearRecord;
    const { container } = render(
      <Ledger age={4} earlier={[past]} tray={null} narrow={false}>
        <p>Now</p>
      </Ledger>,
    );
    expect(container.querySelectorAll("[data-settling]")).toHaveLength(1);
  });
});

describe("UI-013: the motion in the style sheets stays small and gentle", () => {
  const sheets = ["Ledger", "RingsThumb"].map((name) => ({
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
