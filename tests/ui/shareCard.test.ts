// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RING_THEMES } from "../../src/engine/rings";
import type { LifeSummary } from "../../src/engine/summary";
import { CARD_COLOURS, CARD_HEIGHT, CARD_WIDTH, shareCardSvg } from "../../src/ui/shareCard";
import { makeCountry } from "../fixtures/country";
import { finishedLife } from "./fakes";

const country = makeCountry({ region: "Western Africa" });
const { summary: base } = finishedLife("share-seed-1", country);

const withChanges = (changes: Partial<LifeSummary> = {}): LifeSummary => ({ ...base, ...changes });

const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml");

describe("SHARE-002: the share image", () => {
  it("is well-formed SVG of the card's size, with a title and a description for whoever cannot see it", () => {
    const doc = parse(shareCardSvg(withChanges()));
    expect(doc.querySelector("parsererror")).toBeNull();
    const svg = doc.documentElement;
    expect(svg.getAttribute("width")).toBe(String(CARD_WIDTH));
    expect(svg.getAttribute("height")).toBe(String(CARD_HEIGHT));
    expect(svg.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
    expect(doc.querySelector("title")?.textContent).toContain(base.name);
    expect(doc.querySelector("desc")?.textContent).toMatch(/years?/);
  });

  it("draws one ring a year, the oldest innermost, and no numbered marks (there is no list beside it)", () => {
    const doc = parse(shareCardSvg(withChanges()));
    const rings = doc.querySelectorAll("circle[data-ring]");
    expect(rings).toHaveLength(base.rings.length);
    // Numbers on the summary's rings are badges (a disc and a number); the card has no discs and no digit-only text.
    expect([...doc.querySelectorAll("text")].filter((el) => /^\d+$/.test(el.textContent ?? ""))).toHaveLength(0);
    expect(doc.querySelectorAll("circle:not([data-ring])")).toHaveLength(0);
  });

  it("names the person, the place and the years, and gives the shares and where the game is", () => {
    const text = parse(shareCardSvg(withChanges())).documentElement.textContent ?? "";
    expect(text).toContain(base.name);
    expect(text).toContain(`Testland, ${base.birthYear} to ${base.death.year}`);
    expect(text).toMatch(/\d+% circumstance · \d+% choice · \d+% chance/);
    expect(text).toContain("Birthright");
    expect(text).toContain("roman-kravtsov.github.io/life-simulator");
  });

  it("does not state a death by suicide as the cause", () => {
    const text =
      parse(shareCardSvg(withChanges({ death: { ...base.death, cause: "selfHarm", age: 31 } }))).documentElement
        .textContent ?? "";
    expect(text).toContain("Died at 31.");
    expect(text).not.toMatch(/Died at 31, of/);
  });

  it("legends only the themes the life has, each with a swatch drawn in its own pattern", () => {
    const doc = parse(shareCardSvg(withChanges()));
    const used = RING_THEMES.filter((theme) => base.rings.some((ring) => ring.theme === theme));
    const legend = [...doc.querySelectorAll("[data-legend]")].map((el) => el.getAttribute("data-legend"));
    expect(legend).toEqual(used);
    const patterns = [...doc.querySelectorAll("pattern")].map((el) => el.getAttribute("id"));
    for (const theme of used.filter((theme) => theme !== "plain")) {
      expect(patterns).toContain(`ring-${theme}`);
      expect(patterns).toContain(`swatch-${theme}`);
    }
  });

  it("draws each theme in a pattern of its own, so colour is never the only signal", () => {
    // A life long enough to hold every theme.
    const themes = RING_THEMES.map((theme, index) => ({ age: index, thickness: 0.6, theme }));
    const doc = parse(shareCardSvg(withChanges({ rings: themes })));
    const ring = [...doc.querySelectorAll("pattern")].filter((p) => p.getAttribute("id")!.startsWith("ring-"));
    expect(ring).toHaveLength(RING_THEMES.length - 1);
    const signatures = ring.map((p) => p.innerHTML.replace(/ id="[^"]*"/g, ""));
    expect(new Set(signatures).size).toBe(signatures.length);
    const swatches = [...doc.querySelectorAll("pattern")].filter((p) => p.getAttribute("id")!.startsWith("swatch-"));
    expect(swatches).toHaveLength(RING_THEMES.length);
    expect(new Set(swatches.map((p) => p.innerHTML)).size).toBe(swatches.length);
  });

  it("escapes what it is given, so a name with markup in it cannot break the picture or inject into it", () => {
    const name = `Ana <b>&"O'Neil"</b>`;
    const svg = shareCardSvg(withChanges({ name, epitaph: "<script>x</script>" }));
    const doc = parse(svg);
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector("b, script")).toBeNull();
    expect(doc.documentElement.textContent).toContain(name);
  });

  it("makes a long name smaller rather than letting it run off the card", () => {
    const sizeOf = (name: string) => {
      const title = parse(shareCardSvg(withChanges({ name }))).querySelector("text[data-name]");
      return Number(title?.getAttribute("font-size"));
    };
    expect(sizeOf("Ana Li")).toBeGreaterThan(sizeOf("Maria Fernanda de los Angeles Santa Cruz y Montenegro"));
  });

  it("uses fixed colours, never page variables, which an image has no page to read", () => {
    const svg = shareCardSvg(withChanges());
    expect(svg).not.toMatch(/var\(|currentColor|class=/);
  });

  it("keeps its palette equal to the light tokens in styles.css", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const light = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
    const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(light)?.[1]?.toLowerCase();
    expect(CARD_COLOURS.paper).toBe(token("paper"));
    expect(CARD_COLOURS.ink).toBe(token("ink"));
    expect(CARD_COLOURS.inkSoft).toBe(token("ink-soft"));
    for (const theme of RING_THEMES) expect(CARD_COLOURS.ring[theme]).toBe(token(`ring-${theme}`));
  });

  it("draws every finished life without leaving a placeholder or NaN in it", () => {
    for (const seed of ["card-a", "card-b", "card-c", "card-d"]) {
      const svg = shareCardSvg(finishedLife(seed, country).summary);
      expect(svg).not.toMatch(/[{}]|undefined|NaN|Infinity/);
      expect(parse(svg).querySelector("parsererror")).toBeNull();
    }
  });
});
