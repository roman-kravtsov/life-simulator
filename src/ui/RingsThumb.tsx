// The growth rings as a small picture beside the stats on the life screen (SUM-002, UI-004): the same layout as the
// full figure on the summary, one ring a year, but without the patterns, marks and legend, which only fit at size.
// It is decoration for the line beside it ("12 years, one ring each"), so a screen reader skips it.
import { useMemo } from "react";
import type { Ring } from "../engine/rings";
import styles from "./RingsThumb.module.css";
import { layoutRings, VIEW_SIZE } from "./ringsLayout";

export function RingsThumb({ rings }: { rings: readonly Ring[] }) {
  const { shapes } = useMemo(() => layoutRings(rings), [rings]);
  return (
    <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className={styles.thumb} aria-hidden="true" focusable="false">
      {/* A person not yet a year old has one dot where the centre will be. */}
      {shapes.length === 0 && <circle cx={VIEW_SIZE / 2} cy={VIEW_SIZE / 2} r={5} className={styles.seed} />}
      {/* The outermost ring first, so each younger ring is drawn on top of the one around it. */}
      {shapes
        .map((shape) => (
          <circle
            key={shape.ring}
            cx={VIEW_SIZE / 2}
            cy={VIEW_SIZE / 2}
            r={shape.outer}
            className={`${styles.ring} ${styles[`fill-${shape.theme}`]}`}
          />
        ))
        .reverse()}
    </svg>
  );
}
