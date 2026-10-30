// The growth rings as a small picture beside the stats on the life screen (SUM-002, UI-004): the same layout as the
// full figure on the summary, one ring a year, but without the patterns, marks and legend, which only fit at size.
// It is decoration for the line beside it ("12 years, one ring each"), so a screen reader skips it. The past lives
// (UI-008) show one for each life from the rings in brief that the archive keeps, which have only thickness and theme.
import { useMemo, useState, type CSSProperties } from "react";
import styles from "./RingsThumb.module.css";
import { layoutRings, OUTER_RADIUS, VIEW_SIZE, type RingInput } from "./ringsLayout";

interface Props {
  rings: readonly RingInput[];
  /** Sets the size where the picture is used; 3.25rem across otherwise. */
  className?: string;
  /** The newest ring grows from the centre and the older ones ease to their new size when a year is added (UI-013). */
  grow?: boolean;
}

/**
 * The line of paper between rings, in view box units: 1 while the rings are wide, thinner once there are more than
 * about fifteen, so the lines of a long life do not cover its rings and leave the picture pale.
 */
const lineWidth = (count: number) => Math.min(1, OUTER_RADIUS / Math.max(count, 1) / 3);

export function RingsThumb({ rings, className, grow = false }: Props) {
  const { shapes } = useMemo(() => layoutRings(rings), [rings]);
  // How many rings there were when the newest finished growing: it grows once, not again when the picture is shown anew
  // (the narrow layout hides and shows its panels).
  const [grown, setGrown] = useState<number | null>(null);
  return (
    <svg
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      className={className ? `${styles.thumb} ${className}` : styles.thumb}
      style={{ "--ring-line": lineWidth(shapes.length) } as CSSProperties}
      aria-hidden="true"
      focusable="false"
    >
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
            data-newest={grow && shape.ring === shapes.length - 1 && grown !== shapes.length ? "" : undefined}
            onAnimationEnd={() => setGrown(shapes.length)}
          />
        ))
        .reverse()}
    </svg>
  );
}
