// The centre of the life screen (UI-004): a ledger of years. This year is on top, told in full (the caller supplies
// it: the heading, the story, a decision waiting), and the earlier years follow below it, newest first, each a
// paragraph beside its age. Earlier years are for reading, not for acting on.
import { memo, useState, type ReactNode } from "react";
import type { YearRecord } from "../engine/types";
import { t } from "../i18n";
import { HelpNote } from "./HelpNote";
import styles from "./Ledger.module.css";
import { yearText } from "./words";

/** An earlier year. Memoised: the years already told never change, so a new year does not redraw them. */
const PastYear = memo(function PastYear({ record }: { record: YearRecord }) {
  // Help stays beside a hard year as it did when the year was told.
  const topics = [...new Set(record.events.flatMap((event) => (event.helpTopic ? [event.helpTopic] : [])))];
  return (
    <li className={`${styles.entry} ${styles.past}`}>
      <span className={styles.year}>
        <span className="visually-hidden">{t("life.age", { age: record.age })}.</span>
        <span aria-hidden="true">{record.age}</span>
      </span>
      <div className={styles.body}>
        <p>{yearText(record)}</p>
        {topics.map((topic) => (
          <HelpNote key={topic} topic={topic} />
        ))}
      </div>
    </li>
  );
});

interface Props {
  /** The age being lived, for the gutter beside this year. */
  age: number;
  /** This year, told in full. */
  children: ReactNode;
  /** The years before this one, oldest first, as the life records them. */
  earlier: readonly YearRecord[];
  /** The plan tray, docked under the ledger when the window is big enough; absent while a decision waits. */
  tray: ReactNode;
  narrow: boolean;
}

export function Ledger({ age, children, earlier, tray, narrow }: Props) {
  // The age whose settling has finished (UI-013). The body wears `data-settling` until then and not after, so it settles
  // once for each age, whatever the jump (a quiet run passes several years in one go), and a panel hidden and shown again
  // (the narrow layout's tabs) does not replay it.
  const [settled, setSettled] = useState<number | null>(null);
  return (
    <div className={`${styles.centre} ${narrow ? styles.flow : ""}`}>
      <div className={styles.part}>
        <div className={`${styles.entry} ${earlier.length === 0 ? styles.last : ""}`}>
          <span className={styles.year} aria-hidden="true">
            {age}
            <small>{t("life.now")}</small>
          </span>
          {/* Not remounted for a new year: the body holds focus and the hints. */}
          <div
            className={`${styles.body} ${styles.now}`}
            data-settling={settled === age ? undefined : ""}
            onAnimationEnd={(event) => {
              // Only its own animation counts; one inside the year (a child's) does not.
              if (event.target === event.currentTarget) setSettled(age);
            }}
          >
            {children}
          </div>
        </div>
      </div>
      {/* After this year and before the earlier ones, so the plan is next to what it is for and the keyboard reaches it
          before a long history; where it is docked at the foot of the window, CSS puts it last. */}
      {tray && <div className={styles.tray}>{tray}</div>}
      {earlier.length > 0 && (
        <div className={`${styles.part} ${styles.rest}`}>
          <ol aria-label={t("life.earlier")} className={styles.earlier}>
            {[...earlier].reverse().map((record) => (
              <PastYear key={record.age} record={record} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
