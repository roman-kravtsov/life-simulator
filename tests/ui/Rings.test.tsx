// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Ring } from "../../src/engine/rings";
import { Rings } from "../../src/ui/Rings";
import { layoutRings, MARK_RADIUS, OUTER_RADIUS } from "../../src/ui/ringsLayout";

const THEMES = ["study", "work", "love", "loss", "illness", "move", "plain"] as const;

/** A life of 30 years that cycles through the themes, with key moments in some years. */
function life(years = 30, momentAges: number[] = [3, 8, 13, 21]): Ring[] {
  return Array.from({ length: years }, (_, age) => ({
    age,
    thickness: 0.2 + 0.8 * (((age * 37) % 100) / 100),
    theme: THEMES[age % THEMES.length]!,
    ...(momentAges.includes(age) ? { moment: momentAges.indexOf(age) + 1 } : {}),
  }));
}

describe("SUM-002: where the rings and their marks go", () => {
  it("makes each ring larger than the one before it, in step with its thickness, and fills the circle", () => {
    const rings = life(20);
    const { shapes } = layoutRings(rings);
    expect(shapes).toHaveLength(20);
    for (let i = 1; i < shapes.length; i++) expect(shapes[i]!.outer).toBeGreaterThan(shapes[i - 1]!.outer);
    expect(shapes.at(-1)!.outer).toBeCloseTo(OUTER_RADIUS, 6);
    const widths = shapes.map((s) => s.outer - s.inner);
    const unit = widths[0]! / rings[0]!.thickness;
    widths.forEach((w, i) => expect(w / rings[i]!.thickness).toBeCloseTo(unit, 6));
    expect(shapes[0]!.inner).toBe(0);
  });

  it("puts each mark on its own ring, numbered by its moment, spread round the circle without overlap", () => {
    const rings = life(60, [4, 5, 6, 20, 21, 22, 40, 41, 42, 55, 56, 57]);
    const { shapes, marks } = layoutRings(rings);
    expect(marks.map((m) => m.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const mark of marks) {
      const shape = shapes[mark.ring]!;
      expect(rings[mark.ring]!.moment).toBe(mark.number);
      // What the mark points at is always the middle of its own ring.
      expect(Math.hypot(mark.anchorX - 50, mark.anchorY - 50)).toBeCloseTo((shape.outer + shape.inner) / 2, 6);
    }
    const angles = new Set(marks.map((m) => Math.round(Math.atan2(m.y - 50, m.x - 50) * 10)));
    expect(angles.size).toBeGreaterThan(8);
    for (let a = 0; a < marks.length; a++) {
      for (let b = a + 1; b < marks.length; b++) {
        const gap = Math.hypot(marks[a]!.x - marks[b]!.x, marks[a]!.y - marks[b]!.y);
        expect(gap).toBeGreaterThanOrEqual(2 * MARK_RADIUS);
      }
    }
  });

  it("keeps a mark on a very narrow ring near the centre readable by moving it out with a line to its ring", () => {
    const rings = life(80, [0, 1, 2, 3, 4]);
    const { shapes, marks } = layoutRings(rings);
    expect(marks).toHaveLength(5);
    for (const mark of marks) {
      expect(Math.hypot(mark.x - 50, mark.y - 50)).toBeGreaterThan(MARK_RADIUS);
      expect(shapes[mark.ring]!.outer).toBeLessThan(6);
    }
    for (let a = 0; a < marks.length; a++) {
      for (let b = a + 1; b < marks.length; b++) {
        expect(Math.hypot(marks[a]!.x - marks[b]!.x, marks[a]!.y - marks[b]!.y)).toBeGreaterThanOrEqual(
          2 * MARK_RADIUS,
        );
      }
    }
  });

  it("is deterministic, handles a single ring and no rings", () => {
    expect(layoutRings(life(30))).toEqual(layoutRings(life(30)));
    const one = layoutRings([{ age: 0, thickness: 0.5, theme: "plain" }]);
    expect(one.shapes[0]).toMatchObject({ inner: 0, outer: OUTER_RADIUS });
    expect(one.marks).toEqual([]);
    expect(layoutRings([])).toEqual({ shapes: [], marks: [] });
  });
});

describe("SUM-002: the rings figure", () => {
  const setup = (rings = life(), name = "Amara") => {
    const view = render(<Rings rings={rings} name={name} />);
    return { ...view, user: userEvent.setup() };
  };

  it("draws one ring for each year and says what the picture is", () => {
    const { container } = setup(life(30));
    expect(container.querySelectorAll("circle[data-ring]")).toHaveLength(30);
    const picture = screen.getByRole("img", {
      name: /Amara's life: 30 rings, one for each year, from age 0 to age 29/,
    });
    expect(picture.tagName.toLowerCase()).toBe("svg");
  });

  it("says it plainly when there is one ring", () => {
    setup([{ age: 0, thickness: 0.4, theme: "plain" }]);
    expect(screen.getByRole("img", { name: "The ring of Amara's life: one year, at age 0." })).toBeInTheDocument();
  });

  it("fills each theme with a pattern of its own, so colour is never the only signal", () => {
    const { container } = setup(life(30));
    const patterns = [...container.querySelectorAll("pattern")];
    // Six patterned themes in the picture; the plain year is a solid colour.
    const figure = container.querySelector("svg[role='img']")!;
    const used = new Map<string, string>();
    for (const circle of figure.querySelectorAll("circle[data-ring]")) {
      const theme = circle.getAttribute("data-theme")!;
      used.set(theme, circle.getAttribute("fill") ?? "");
    }
    expect([...used.keys()].sort()).toEqual([...THEMES].sort());
    const patterned = [...used.entries()].filter(([theme]) => theme !== "plain");
    expect(new Set(patterned.map(([, fill]) => fill)).size).toBe(6);
    for (const [, fill] of patterned) {
      const id = /url\(#(.+)\)/.exec(fill)![1]!;
      expect(figure.querySelector(`pattern[id="${id}"]`)).not.toBeNull();
    }
    // The shapes of the marks differ too: dots, lines, waves.
    const signatures = patterns
      .filter((p) => figure.contains(p))
      .map((p) => p.outerHTML.replace(/ (class|id)="[^"]*"/g, ""));
    expect(new Set(signatures).size).toBe(signatures.length);
    expect(used.get("plain")).not.toMatch(/^url/);
  });

  it("numbers the marks like the key moments", () => {
    const { container } = setup(life(30, [3, 8, 13, 21]));
    const marks = [...container.querySelectorAll("[data-mark]")];
    expect(marks.map((m) => m.textContent)).toEqual(["1", "2", "3", "4"]);
  });

  it("lists the themes that occur in the legend, with their words, and no others", () => {
    setup(life(3));
    const legend = screen.getByRole("list", { name: "What each colour and pattern means" });
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["School and study", "Work", "Love and family"]);
  });

  it("gives a screen reader the same information as a table, year by year", async () => {
    const { user } = setup(life(8, [3]));
    await user.click(screen.getByText("Year by year"));
    const table = screen.getByRole("table", { name: "How each year of the life is drawn" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Age", "What the year was about", "How the year felt", "Key moment"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(8);
    const cells = (row: HTMLElement) =>
      within(row)
        .getAllByRole("cell")
        .map((c) => c.textContent);
    expect(cells(rows[0]!)).toEqual(["0", "School and study", "A hard year", ""]);
    expect(cells(rows[3]!)[3]).toBe("Moment 1");
    // The thickness in words follows happiness: thin years are hard, thick years happy.
    const words = rows.map((r) => cells(r)[2]);
    expect(words.every((w) => /^A (hard|heavy|gentle|happy) year$/.test(w ?? ""))).toBe(true);
  });

  it("explains what thickness means", () => {
    setup();
    expect(screen.getByText(/Thicker rings were happier years/)).toBeInTheDocument();
  });

  it("gives every figure its own pattern ids, so two on one page do not clash", () => {
    const { container } = render(
      <>
        <Rings rings={life(5)} name="One" />
        <Rings rings={life(5)} name="Two" />
      </>,
    );
    const ids = [...container.querySelectorAll("pattern")].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
