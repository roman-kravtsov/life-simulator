// The share image (SHARE-002): the life's growth rings on a card, as an SVG document in a string. Pure, so it is
// tested without a browser; src/save/share.ts turns it into a PNG. It stands alone: fixed colours (the light
// tokens of src/styles.css, whatever theme the player reads in, and a test keeps them equal), system fonts, and
// every theme drawn in its own pattern as well as its colour. There are no numbered marks, as there is no list of
// moments beside it.
import { SITE_URL } from "../content/site";
import { RING_THEMES, type Ring } from "../engine/rings";
import type { LifeSummary } from "../engine/summary";
import { countryName } from "../format";
import { t } from "../i18n";
import { diedLine, shareShares } from "./share";
import { layoutRings, PATTERN_TURN, patternMark, patternStroke, patternTile, VIEW_SIZE } from "./ringsLayout";
import { yearsWords } from "./words";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 1500;

type Theme = Ring["theme"];

/** The light tokens of src/styles.css, which a test holds equal to the style sheet. */
export const CARD_COLOURS = {
  paper: "#f6f1e7",
  ink: "#2b241d",
  inkSoft: "#5d5246",
  rule: "#d9cfbf",
  ring: {
    study: "#3f6b85",
    work: "#8f6a12",
    love: "#9c4a2f",
    loss: "#5b6470",
    illness: "#7a5573",
    move: "#5f7148",
    plain: "#8a7a5f",
  } satisfies Record<Theme, string>,
};

const STORY_FONT = "'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif";
const UI_FONT = "system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/** Where the rings go on the card, and how wide the words may be. */
const RINGS_SIZE = 880;
const RINGS_TOP = 240;
const TEXT_WIDTH = 1000;
/** A letter is about this wide as a share of its font size: a generous guess, so words never run off the card. */
const LETTER = 0.54;
/** The tile of the legend's swatches, which are drawn in a 12 unit box (as in the summary screen). */
const SWATCH_TILE = 2.4;
const SWATCH = 30;

const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** The largest size, up to `size`, at which `text` fits in the width of the card's text. */
const fit = (text: string, size: number): number =>
  Math.round(Math.min(size, TEXT_WIDTH / (Math.max(text.length, 1) * LETTER)));

function text(
  content: string,
  y: number,
  size: number,
  { fill = CARD_COLOURS.ink, font = UI_FONT, weight = 400, extra = "" } = {},
): string {
  return (
    `<text x="${CARD_WIDTH / 2}" y="${y}" text-anchor="middle" font-family="${font}" font-size="${size}" ` +
    `font-weight="${weight}" fill="${fill}"${extra}>${escape(content)}</text>`
  );
}

function pattern(id: string, theme: Theme, tile: number): string {
  const turn = PATTERN_TURN[theme];
  const mark = theme === "plain" ? null : patternMark(theme, tile);
  const drawn = mark
    ? mark.dot
      ? `<path d="${mark.d}" fill="${CARD_COLOURS.paper}"/>`
      : `<path d="${mark.d}" fill="none" stroke="${CARD_COLOURS.paper}" stroke-width="${patternStroke(tile)}"/>`
    : "";
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"` +
    `${turn ? ` patternTransform="rotate(${turn})"` : ""}>` +
    `<rect width="${tile}" height="${tile}" fill="${CARD_COLOURS.ring[theme]}"/>${drawn}</pattern>`
  );
}

/** The legend as rows that fit the card, each centred: a swatch in the theme's pattern, then its name. */
function legend(themes: readonly Theme[], top: number): string {
  const GAP = 38;
  const items = themes.map((theme) => {
    const label = t(`ring.theme.${theme}`);
    return { theme, label, width: SWATCH + 10 + Math.ceil(label.length * 28 * LETTER) };
  });
  const rows: (typeof items)[] = [[]];
  for (const item of items) {
    const row = rows.at(-1)!;
    const used = row.reduce((sum, entry) => sum + entry.width + GAP, 0);
    if (row.length > 0 && used + item.width > TEXT_WIDTH) rows.push([item]);
    else row.push(item);
  }
  return rows
    .map((row, index) => {
      const total = row.reduce((sum, entry) => sum + entry.width, 0) + GAP * (row.length - 1);
      let x = (CARD_WIDTH - total) / 2;
      const y = top + index * 48;
      return row
        .map(({ theme, label, width }) => {
          const at = x;
          x += width + GAP;
          return (
            `<g data-legend="${theme}">` +
            `<svg x="${at}" y="${y}" width="${SWATCH}" height="${SWATCH}" viewBox="0 0 12 12">` +
            `<rect x="0.5" y="0.5" width="11" height="11" fill="url(#swatch-${theme})" stroke="${CARD_COLOURS.inkSoft}" stroke-width="0.6"/></svg>` +
            `<text x="${at + SWATCH + 10}" y="${y + 25}" font-family="${UI_FONT}" font-size="28" fill="${CARD_COLOURS.ink}">${escape(label)}</text>` +
            `</g>`
          );
        })
        .join("");
    })
    .join("");
}

/** The card as an SVG document: the person, the place and years, the rings, how it ended and what shaped it. */
export function shareCardSvg(summary: LifeSummary): string {
  const { name, death, rings } = summary;
  const country = countryName(summary.country);
  const subtitle = t("summary.subtitle", { country, born: summary.birthYear, died: death.year });
  const died = diedLine(summary);
  const shaped = t("share.card.shaped", shareShares(summary));
  const themes = RING_THEMES.filter((theme) => rings.some((ring) => ring.theme === theme));
  const tile = patternTile(rings.length);
  const { shapes } = layoutRings(rings);
  const address = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const defs = [
    ...themes.filter((theme) => theme !== "plain").map((theme) => pattern(`ring-${theme}`, theme, tile)),
    ...themes.map((theme) => pattern(`swatch-${theme}`, theme, SWATCH_TILE)),
  ].join("");
  // The outermost ring first, so each younger ring is drawn on top of it; a line of paper parts neighbours.
  const circles = shapes
    .map((shape) => {
      const first = shape.ring === shapes.length - 1;
      return (
        `<circle data-ring="${shape.ring}" data-theme="${shape.theme}" cx="${VIEW_SIZE / 2}" cy="${VIEW_SIZE / 2}" ` +
        `r="${shape.outer}" fill="${shape.theme === "plain" ? CARD_COLOURS.ring.plain : `url(#ring-${shape.theme})`}" ` +
        `stroke="${first ? CARD_COLOURS.inkSoft : CARD_COLOURS.paper}" stroke-width="${first ? 0.3 : 0.18}"/>`
      );
    })
    .reverse()
    .join("");
  const nameSize = fit(name, 68);
  const label = t("share.card.label", {
    name,
    years: yearsWords(death.age),
    country,
    born: summary.birthYear,
    died: death.year,
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" ` +
    `viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img">` +
    `<title>${escape(t("share.card.title", { name }))}</title><desc>${escape(label)}</desc>` +
    `<defs>${defs}</defs>` +
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${CARD_COLOURS.paper}"/>` +
    `<rect x="36" y="36" width="${CARD_WIDTH - 72}" height="${CARD_HEIGHT - 72}" fill="none" stroke="${CARD_COLOURS.rule}" stroke-width="2"/>` +
    text(name, 150, nameSize, { font: STORY_FONT, weight: 600, extra: ` data-name="1"` }) +
    text(subtitle, 205, fit(subtitle, 34), { fill: CARD_COLOURS.inkSoft }) +
    `<svg x="${(CARD_WIDTH - RINGS_SIZE) / 2}" y="${RINGS_TOP}" width="${RINGS_SIZE}" height="${RINGS_SIZE}" viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}">${circles}</svg>` +
    text(died, 1195, fit(died, 36), { font: STORY_FONT }) +
    text(shaped, 1245, fit(shaped, 30), { fill: CARD_COLOURS.inkSoft }) +
    legend(themes, 1292) +
    text(t("share.card.footer", { title: t("app.title"), subtitle: t("app.subtitle") }), 1418, 32, {
      fill: CARD_COLOURS.inkSoft,
      weight: 600,
    }) +
    text(address, 1458, 28, { fill: CARD_COLOURS.inkSoft }) +
    `</svg>`
  );
}
