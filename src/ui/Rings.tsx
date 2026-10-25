// The life as growth rings (SUM-002, design 1.3): plain SVG, one ring a year, the first at the centre. The
// thickness of a ring is how happy the year was, its colour and pattern what the year was mostly about, and a
// numbered mark sits on each year that holds a key moment. Colour is never the only signal: every theme has a
// pattern of its own, a legend names them, and a table gives a screen reader the same year-by-year facts.
import { useId, useMemo, type CSSProperties } from "react";
import { formatNumber, pluralKey } from "../format";
import { t } from "../i18n";
import type { Ring } from "../engine/rings";
import styles from "./Rings.module.css";
import { layoutRings, MARK_RADIUS, patternTile, VIEW_SIZE, type RingMark } from "./ringsLayout";
import { RING_THEMES } from "./store";
import { ringFeltKey } from "./words";

type Theme = Ring["theme"];

/** The tile of the legend's swatches, which are drawn in a 12 unit box. */
const SWATCH_TILE = 2.4;

/**
 * The marks drawn over the colour, as paths in one tile: dots, lines each way, waves. The plain year is a
 * solid colour and has none. Dots are filled; the rest are strokes.
 */
function markOf(theme: Exclude<Theme, "plain">, tile: number): { d: string; dot?: boolean } {
  const mid = tile / 2;
  const dot = tile * 0.175;
  switch (theme) {
    case "study":
      return {
        d: `M${mid - dot} ${mid}a${dot} ${dot} 0 1 0 ${2 * dot} 0a${dot} ${dot} 0 1 0 ${-2 * dot} 0z`,
        dot: true,
      };
    case "work":
    case "illness":
      return { d: `M${mid} 0V${tile}` };
    case "love":
      return { d: `M${mid} 0V${tile}M0 ${mid}H${tile}` };
    case "loss":
      return { d: `M0 ${mid}H${tile}` };
    case "move":
      return { d: `M0 ${mid}Q${tile / 4} ${tile * 0.125} ${mid} ${mid}T${tile} ${mid}` };
  }
}

/** Work and love are drawn as diagonals: the same lines, turned. */
const TURNED: Partial<Record<Theme, number>> = { work: 45, love: 45 };

function Pattern({ id, theme, tile }: { id: string; theme: Theme; tile: number }) {
  const turn = TURNED[theme];
  const mark = theme === "plain" ? null : markOf(theme, tile);
  return (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={tile}
      height={tile}
      {...(turn ? { patternTransform: `rotate(${turn})` } : {})}
    >
      <rect width={tile} height={tile} className={styles[`fill-${theme}`]} />
      {mark && (
        <path
          d={mark.d}
          className={mark.dot ? styles.markFill : styles.markLine}
          {...(mark.dot ? {} : { strokeWidth: Math.max(tile * 0.17, 0.22) })}
        />
      )}
    </pattern>
  );
}

/** What a ring is filled with: its pattern, or the plain colour. */
const fillOf = (uid: string, theme: Theme): string | undefined =>
  theme === "plain" ? undefined : `url(#${uid}-${theme})`;

function Swatch({ uid, theme }: { uid: string; theme: Theme }) {
  const id = `${uid}-swatch-${theme}`;
  return (
    <svg viewBox="0 0 12 12" className={styles.swatch} aria-hidden="true" focusable="false">
      <defs>
        <Pattern id={id} theme={theme} tile={SWATCH_TILE} />
      </defs>
      <rect x={0.5} y={0.5} width={11} height={11} fill={`url(#${id})`} className={styles.swatchEdge} />
    </svg>
  );
}

function Mark({ mark }: { mark: RingMark }) {
  // A badge that had to move out from its ring is joined to the ring by a line ending in a dot.
  const joined = MARK_RADIUS < Math.hypot(mark.x - mark.anchorX, mark.y - mark.anchorY);
  return (
    <g data-mark={mark.number} className={styles.mark}>
      {joined && (
        <>
          <line x1={mark.anchorX} y1={mark.anchorY} x2={mark.x} y2={mark.y} className={styles.leaderCasing} />
          <line x1={mark.anchorX} y1={mark.anchorY} x2={mark.x} y2={mark.y} className={styles.leader} />
          <circle cx={mark.anchorX} cy={mark.anchorY} r={0.7} className={styles.anchor} />
        </>
      )}
      <g transform={`translate(${mark.x} ${mark.y})`}>
        <circle r={MARK_RADIUS} className={styles.markDisc} />
        <text className={styles.markNumber} textAnchor="middle" dominantBaseline="central">
          {mark.number}
        </text>
      </g>
    </g>
  );
}

export function Rings({ rings, name }: { rings: readonly Ring[]; name: string }) {
  // Ids are used in url(#...), so keep them to word characters.
  const uid = useId().replace(/\W/g, "");
  const captionId = `${uid}-caption`;
  const tile = patternTile(rings.length);
  const { shapes, marks } = useMemo(() => layoutRings(rings), [rings]);
  const themes = RING_THEMES.filter((theme) => rings.some((ring) => ring.theme === theme));
  const first = rings[0]?.age ?? 0;
  const last = rings.at(-1)?.age ?? 0;
  const label = t(pluralKey("summary.rings.label", rings.length), {
    name,
    count: formatNumber(rings.length),
    first,
    last,
  });

  return (
    <figure className={styles.figure} aria-label={t("summary.rings.heading")}>
      <svg
        role="img"
        aria-label={label}
        aria-describedby={captionId}
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className={styles.rings}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {themes
            .filter((theme) => theme !== "plain")
            .map((theme) => (
              <Pattern key={theme} id={`${uid}-${theme}`} theme={theme} tile={tile} />
            ))}
        </defs>
        {/* The outermost ring first, so each younger ring is drawn on top of the one around it. */}
        {shapes
          .map((shape) => (
            <circle
              key={shape.ring}
              data-ring={shape.ring}
              data-age={shape.age}
              data-theme={shape.theme}
              cx={VIEW_SIZE / 2}
              cy={VIEW_SIZE / 2}
              r={shape.outer}
              fill={fillOf(uid, shape.theme)}
              className={shape.theme === "plain" ? `${styles.ring} ${styles["fill-plain"]}` : styles.ring}
              style={{ "--i": shape.ring } as CSSProperties}
            />
          ))
          .reverse()}
        {marks.map((mark) => (
          <Mark key={mark.number} mark={mark} />
        ))}
      </svg>
      <figcaption id={captionId} className={styles.caption}>
        {t("summary.rings.caption")}
      </figcaption>
      <ul role="list" className={styles.legend} aria-label={t("summary.rings.legend")}>
        {themes.map((theme) => (
          <li key={theme}>
            <Swatch uid={uid} theme={theme} />
            {t(`ring.theme.${theme}`)}
          </li>
        ))}
      </ul>
      <details className={`disclosure ${styles.table}`}>
        <summary>{t("summary.rings.table")}</summary>
        <table>
          <caption className="visually-hidden">{t("summary.rings.table.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("summary.rings.col.age")}</th>
              <th scope="col">{t("summary.rings.col.theme")}</th>
              <th scope="col">{t("summary.rings.col.felt")}</th>
              <th scope="col">{t("summary.rings.col.moment")}</th>
            </tr>
          </thead>
          <tbody>
            {rings.map((ring) => (
              <tr key={ring.age}>
                <td>{ring.age}</td>
                <td>{t(`ring.theme.${ring.theme}`)}</td>
                <td>{t(ringFeltKey(ring.thickness))}</td>
                <td>
                  {ring.moment === undefined ? (
                    <>
                      <span aria-hidden="true">{t("summary.rings.none.mark")}</span>
                      <span className="visually-hidden">{t("summary.rings.none")}</span>
                    </>
                  ) : (
                    t("summary.rings.moment", { number: ring.moment })
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
