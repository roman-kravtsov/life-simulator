// The life as growth rings (SUM-002, design 1.3): plain SVG, one ring a year, the first at the centre. The
// thickness of a ring is how happy the year was, its colour and pattern what the year was mostly about, and a
// numbered mark sits on each year that holds a key moment. Colour is never the only signal: every theme has a
// pattern of its own, a legend names them, and a table gives a screen reader the same year-by-year facts.
import { useId, useMemo, type CSSProperties } from "react";
import { formatNumber, pluralKey } from "../format";
import { t } from "../i18n";
import type { Ring } from "../engine/rings";
import styles from "./Rings.module.css";
import { layoutRings, MARK_RADIUS, VIEW_SIZE, type RingMark } from "./ringsLayout";
import { RING_THEMES } from "./store";
import { ringFeltKey } from "./words";

type Theme = Ring["theme"];

/** Side of one repeat of a pattern, in view box units. */
const TILE = 2.4;
const MID = TILE / 2;

/** Half the width of a dot, in view box units. */
const DOT = 0.42;

/**
 * The marks drawn over the colour, as paths in one tile: dots, lines each way, waves. The plain year is a
 * solid colour and has none. Dots are filled; the rest are strokes.
 */
const MARKS: Record<Exclude<Theme, "plain">, { d: string; dot?: boolean }> = {
  study: { d: `M${MID - DOT} ${MID}a${DOT} ${DOT} 0 1 0 ${2 * DOT} 0a${DOT} ${DOT} 0 1 0 ${-2 * DOT} 0z`, dot: true },
  work: { d: `M${MID} 0V${TILE}` },
  love: { d: `M${MID} 0V${TILE}M0 ${MID}H${TILE}` },
  loss: { d: `M0 ${MID}H${TILE}` },
  illness: { d: `M${MID} 0V${TILE}` },
  move: { d: `M0 ${MID}Q${TILE / 4} 0.3 ${MID} ${MID}T${TILE} ${MID}` },
};

/** Work and love are drawn as diagonals: the same lines, turned. */
const TURNED: Partial<Record<Theme, number>> = { work: 45, love: 45 };

function Pattern({ id, theme }: { id: string; theme: Theme }) {
  const turn = TURNED[theme];
  return (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={TILE}
      height={TILE}
      {...(turn ? { patternTransform: `rotate(${turn})` } : {})}
    >
      <rect width={TILE} height={TILE} className={styles[`fill-${theme}`]} />
      {theme !== "plain" && (
        <path d={MARKS[theme].d} className={MARKS[theme].dot ? styles.markFill : styles.markLine} />
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
        <Pattern id={id} theme={theme} />
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
    <figure className={styles.figure}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className={styles.rings}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {themes
            .filter((theme) => theme !== "plain")
            .map((theme) => (
              <Pattern key={theme} id={`${uid}-${theme}`} theme={theme} />
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
      <figcaption className={styles.caption}>{t("summary.rings.caption")}</figcaption>
      <ul className={styles.legend} aria-label={t("summary.rings.legend")}>
        {themes.map((theme) => (
          <li key={theme}>
            <Swatch uid={uid} theme={theme} />
            {t(`ring.theme.${theme}`)}
          </li>
        ))}
      </ul>
      <details className={styles.table}>
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
                <td>{ring.moment === undefined ? "" : t("summary.rings.moment", { number: ring.moment })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
