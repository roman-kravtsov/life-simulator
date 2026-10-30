// The end of a life (SUM-001, SUM-003, SUM-004, DEATH-002, DEATH-003, DEATH-004): the closing passage, the
// years against the life expectancy of the place, the rings, the key moments, what shaped the life, a few plain
// facts, the last year, the player's notes (SUM-005) and the epitaph. No score and no rank: a life is told, not graded.
import type { Ring } from "../engine/rings";
import type { LifeFacts, LifeSummary } from "../engine/summary";
import type { EventRecord } from "../engine/types";
import type { CountryIndex } from "../engine/world/types";
import { useId, useMemo } from "react";
import { countryName, formatList, formatNumber, formatPercent, pluralKey } from "../format";
import { hasString, t } from "../i18n";
import { Epitaph } from "./Epitaph";
import { DecisionLine, EventLine } from "./EventLine";
import { Page } from "./Page";
import { SiteHeader } from "./SiteHeader";
import { HelpNote } from "./HelpNote";
import { JournalEntries } from "./Journal";
import { Button } from "./kit";
import { Rings } from "./Rings";
import { SharePanel } from "./SharePanel";
import type { GameSnapshot, SummaryView } from "./store";
import styles from "./SummaryScreen.module.css";
import { useFocusOn } from "./useFocusOn";
import { causeWords, sourceTitle, tryT, wholePercents, yearsWords } from "./words";

const STATS = ["health", "happiness", "belonging", "skills"] as const;

/** Lines about things that do not apply to a young life are left out rather than answered with "none". */
const SCHOOL_AGE = 6;
const WORK_AGE = 15;
const ADULT_AGE = 18;

/** The plain facts of the life, one sentence each, saying only what is true. */
function factLines(facts: LifeFacts, age: number): string[] {
  const lines: string[] = [];
  const education = `summary.facts.education.${facts.education}`;
  if (hasString(education) && (facts.education !== "none" || age >= SCHOOL_AGE)) lines.push(t(education));
  if (facts.literate !== undefined)
    lines.push(t(facts.literate ? "summary.facts.literate.yes" : "summary.facts.literate.no"));
  if (facts.yearsWorked > 0) {
    const years = yearsWords(facts.yearsWorked);
    lines.push(
      facts.sector && hasString(`work.sector.${facts.sector}`)
        ? t("summary.facts.work.sector", { years, sector: t(`work.sector.${facts.sector}`) })
        : t("summary.facts.work", { years }),
    );
  } else if (age >= WORK_AGE) {
    lines.push(t("summary.facts.work.none"));
  }
  if (facts.children > 0 || age >= ADULT_AGE) {
    lines.push(
      facts.children === 0
        ? t("summary.facts.children.none")
        : t(pluralKey("summary.facts.children", facts.children), { count: formatNumber(facts.children) }),
    );
  }
  lines.push(
    facts.siblings === 0
      ? t("summary.facts.siblings.none")
      : t(pluralKey("summary.facts.siblings", facts.siblings), { count: formatNumber(facts.siblings) }),
  );
  if (facts.partnered || age >= ADULT_AGE) {
    lines.push(t(facts.partnered ? "summary.facts.partner.yes" : "summary.facts.partner.no"));
  }
  // A condition this version has no name for is left out, not guessed at.
  const conditions = facts.conditions.filter((id) => hasString(`condition.${id}`));
  if (conditions.length > 0) {
    lines.push(t("summary.facts.conditions", { list: formatList(conditions.map((id) => t(`condition.${id}`))) }));
  }
  if (facts.moves > 0) {
    lines.push(t(pluralKey("summary.facts.moves", facts.moves), { count: formatNumber(facts.moves) }));
  }
  return lines;
}

/** The years lived against the expectancy of the place and sex (DEATH-003), as one short paragraph. */
function expectancyText(summary: SummaryView["summary"], sources: CountryIndex["sources"]): string {
  const { death, sex, country } = summary;
  const { expectancy } = death;
  const people = t(`summary.people.${sex}`);
  const parts = [
    t("summary.expectancy.intro", {
      country: countryName(country),
      someone: t(`summary.someone.${sex}`),
      expected: yearsWords(expectancy.expected),
      source: sourceTitle(expectancy.source, sources),
      year: expectancy.year,
    }),
    t(`summary.lived.${expectancy.verdict}`, {
      years: yearsWords(death.age),
      difference: yearsWords(Math.abs(expectancy.difference)),
    }),
  ];
  // Almost everyone reaches a very young age, which is not worth saying.
  if (expectancy.reached < 0.995) {
    const share = Math.round(expectancy.reached * 100);
    parts.push(
      share < 1
        ? t("summary.reached.few", { people, age: death.age })
        : t("summary.reached", { count: formatNumber(share), people, age: death.age }),
    );
  }
  return parts.join(" ");
}

function carriesSuicideHelp({ helpTopic }: EventRecord): boolean {
  return helpTopic === "suicide";
}

/**
 * The key moments this version can still tell, numbered from 1 in order, and the rings renumbered to match, so
 * the marks on the rings and the numbers in the list always agree. A moment whose text is gone is left out and
 * its ring keeps no mark.
 */
function tellable(summary: LifeSummary) {
  const told = summary.moments.map((moment, index) => ({
    moment,
    was: index + 1,
    text: tryT(moment.textKey, moment.vars),
  }));
  const kept = told.filter((entry): entry is typeof entry & { text: string } => entry.text !== null);
  if (kept.length === told.length) return { moments: kept, rings: summary.rings };
  const renumbered = new Map(kept.map((entry, index) => [entry.was, index + 1]));
  const rings = summary.rings.map((ring): Ring => {
    const copy = { ...ring };
    delete copy.moment;
    const number = ring.moment === undefined ? undefined : renumbered.get(ring.moment);
    if (number !== undefined) copy.moment = number;
    return copy;
  });
  return { moments: kept, rings };
}

export interface SummaryScreenProps {
  view: SummaryView;
  sources: CountryIndex["sources"];
  /** Set when the archive would not keep this life, so it may not be in the past lives later. */
  problem: GameSnapshot["problem"];
  onEpitaph: (text: string) => void;
  onAnother: () => void;
  onPast: () => void;
  onBack: () => void;
}

export function SummaryScreen({ view, sources, problem, onEpitaph, onAnother, onPast, onBack }: SummaryScreenProps) {
  const { summary, lastYear } = view;
  const { death, shaping, facts } = summary;
  const { moments, rings } = useMemo(() => {
    return tellable(summary);
  }, [summary]);
  const heading = useFocusOn<HTMLHeadingElement>();
  const notesId = useId();
  // A death by suicide is stated plainly and the help is always there, unless the year's own event carries it.
  const deathHelp = death.cause === "selfHarm" && !lastYear.some(carriesSuicideHelp);
  const percents = wholePercents(shaping.overall);
  const lines = factLines(facts, death.age);
  const coda = tryT(death.codaKey);

  return (
    <Page header={<SiteHeader />}>
      <h1 ref={heading} tabIndex={-1}>
        {summary.name}
        <span className="subtitle">
          {t("summary.subtitle", {
            country: countryName(summary.country),
            born: summary.birthYear,
            died: death.year,
          })}
        </span>
      </h1>
      <p className={styles.died}>{t("summary.died", { age: death.age, cause: causeWords(death.cause) })}</p>
      <div className={styles.passage}>
        <p>{tryT(death.passageKey) ?? t("death.passage.other")}</p>
        {coda && <p>{coda}</p>}
      </div>
      {deathHelp && <HelpNote topic="suicide" />}

      <h2 className={`eyebrow ${styles.heading}`}>{t("summary.expectancy.heading")}</h2>
      <p>{expectancyText(summary, sources)}</p>

      <h2 className={`eyebrow ${styles.heading}`}>{t("summary.rings.heading")}</h2>
      <Rings rings={rings} name={summary.name} />

      {moments.length > 0 && (
        <>
          <h2 className={`eyebrow ${styles.heading}`}>{t("summary.moments.heading")}</h2>
          <p className="small">{t("summary.moments.intro")}</p>
          <ol className={styles.moments}>
            {moments.map(({ moment, text }) => (
              <li key={`${moment.age}-${moment.eventId}`}>
                {t("summary.moment", { age: moment.age, text })}
                {moment.decision && <DecisionLine decision={moment.decision} vars={moment.vars} />}
              </li>
            ))}
          </ol>
        </>
      )}

      <h2 className={`eyebrow ${styles.heading}`}>{t("summary.shaped.heading")}</h2>
      <ul className={styles.list}>
        {STATS.map((id) => (
          <li key={id}>{t(`summary.shaped.${id}.${shaping.stats[id].dominant}`)}</li>
        ))}
      </ul>
      <p>
        {t("summary.shaped.overall", {
          circumstance: formatPercent(percents.circumstance / 100),
          choice: formatPercent(percents.choice / 100),
          chance: formatPercent(percents.chance / 100),
        })}
      </p>
      <details className={`disclosure ${styles.how}`}>
        <summary>{t("summary.shaped.how")}</summary>
        <p>{t("summary.shaped.how.one")}</p>
        <p>{t("summary.shaped.how.two")}</p>
      </details>

      <h2 className={`eyebrow ${styles.heading}`}>{t("summary.facts.heading")}</h2>
      <ul className={styles.list}>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {lastYear.length > 0 && (
        <>
          <h2 className={`eyebrow ${styles.heading}`}>{t("summary.lastYear.heading")}</h2>
          <ul className={styles.list}>
            {lastYear.map((event, index) => (
              <EventLine key={`${index}-${event.id}`} event={event} sources={sources} />
            ))}
          </ul>
        </>
      )}

      {/* An archived summary from before the journal has no field for it. */}
      {(summary.journal?.length ?? 0) > 0 && (
        <section aria-labelledby={notesId}>
          <h2 id={notesId} className={`eyebrow ${styles.heading}`}>
            {t("summary.notes.heading")}
          </h2>
          <JournalEntries entries={summary.journal ?? []} />
        </section>
      )}

      <Epitaph name={summary.name} epitaph={summary.epitaph} onSave={onEpitaph} />

      <SharePanel summary={summary} />

      {/* Said politely when it happens: the archive write finishes after the summary is on screen. */}
      <div aria-live="polite">
        {problem === "archive" && (
          <p className="note" role="note">
            {t("summary.problem")}
          </p>
        )}
      </div>
      <p className="small">{t("summary.seed", { seed: summary.seed })}</p>
      <div className={styles.actions}>
        <Button variant="primary" onPress={onAnother}>
          {t("life.another")}
        </Button>
        <Button onPress={onPast}>{t("summary.past")}</Button>
        <Button onPress={onBack}>{t("life.backToStart")}</Button>
      </div>
    </Page>
  );
}
