// The reference panels under the story on the life screen: school, work, money, health
// conditions and family. Each one is a labelled region that reads as plain lists, so a screen
// reader can jump between them. They only display what `lifeOverview` (store.ts) derives.
import { useId, type ReactNode } from "react";
import type { HelpTopic, Relationship } from "../engine/types";
import { capitalise, formatMoney, pluralKey } from "../format";
import { t } from "../i18n";
import { HelpNote } from "./HelpNote";
import { Switch } from "./kit";
import styles from "./LifePanels.module.css";
import {
  closenessBand,
  type EducationSummary,
  type FamilySummary,
  type LifeOverview,
  type MoneySummary,
  type WorkSummary,
} from "./store";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.panel}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const years = (count: number) => t(pluralKey("common.years", count), { count });

function schoolStatus(education: EducationSummary): string {
  switch (education.kind) {
    case "too-young":
    case "never":
      return t(`school.status.${education.kind}`);
    case "left-early":
      return t("school.status.left-early");
    default:
      return t(`school.status.${education.kind}.${education.level}`);
  }
}

export function SchoolPanel({
  education,
  literacy,
}: {
  education: EducationSummary;
  literacy: LifeOverview["literacy"];
}) {
  const schooled = education.kind !== "too-young" && education.kind !== "never";
  return (
    <Panel title={t("school.heading")}>
      <dl className={styles.facts}>
        <Fact label={t("school.field.level")}>{schoolStatus(education)}</Fact>
        {schooled && education.years > 0 && <Fact label={t("school.field.years")}>{years(education.years)}</Fact>}
        {literacy && <Fact label={t("school.field.reading")}>{t(`school.reading.${literacy}`)}</Fact>}
      </dl>
    </Panel>
  );
}

function workStatus(work: WorkSummary): string {
  if (work.kind !== "working") return t(`work.status.${work.kind}`);
  const terms = t(work.formal ? "work.terms.formal" : "work.terms.informal");
  return work.sector
    ? t("work.status.working", { sector: t(`work.sector.${work.sector}`), terms })
    : t("work.status.working.nosector", { terms });
}

export function WorkPanel({ work }: { work: WorkSummary }) {
  return (
    <Panel title={t("work.heading")}>
      <dl className={styles.facts}>
        <Fact label={t("work.field.status")}>{workStatus(work)}</Fact>
        {work.yearsWorked > 0 && <Fact label={t("work.field.years")}>{years(work.yearsWorked)}</Fact>}
      </dl>
    </Panel>
  );
}

/** An amount that rounds to zero dollars counts as nothing. */
const isNothing = (amount: number) => Math.round(amount) === 0;

interface MoneyPanelProps {
  money: MoneySummary;
  showUsPrices: boolean;
  onToggleUsPrices: () => void;
}

export function MoneyPanel({ money, showUsPrices, onToggleUsPrices }: MoneyPanelProps) {
  const who = money.own ? "own" : "household";
  const { holdings } = money;
  const hasHoldings = holdings !== null && !(isNothing(holdings.savings) && isNothing(holdings.debt));
  return (
    <Panel title={t("money.heading")}>
      <p className="small">{t("money.note", { year: money.year })}</p>
      <dl className={styles.facts}>
        <Fact label={t(`money.field.daily.${who}`)}>{formatMoney(money.daily)}</Fact>
        <Fact label={t(`money.field.yearly.${who}`)}>{formatMoney(money.yearly)}</Fact>
        <Fact label={t("money.field.band")}>{capitalise(t(`money.band.${money.band}`))}</Fact>
        {holdings && hasHoldings && (
          <>
            <Fact label={t("money.field.savings")}>{formatMoney(holdings.savings)}</Fact>
            <Fact label={t("money.field.debt")}>{formatMoney(holdings.debt)}</Fact>
          </>
        )}
        {holdings && !hasHoldings && <Fact label={t("money.field.holdings")}>{t("money.none")}</Fact>}
      </dl>
      <Switch isSelected={showUsPrices} onChange={() => onToggleUsPrices()}>
        {t("money.usSwitch")}
      </Switch>
      {/* Always present, so a screen reader hears the text arrive when the switch is turned on. */}
      <p className="small" aria-live="polite">
        {showUsPrices && t("money.usComparison")}
      </p>
    </Panel>
  );
}

/** Each help topic once, however many of the conditions point to it. */
function helpTopicsOf(conditions: LifeOverview["conditions"]) {
  const topics = new Set<HelpTopic>();
  for (const { helpTopic } of conditions) if (helpTopic) topics.add(helpTopic);
  return [...topics];
}

export function ConditionsPanel({ conditions }: { conditions: LifeOverview["conditions"] }) {
  const helpTopics = helpTopicsOf(conditions);
  return (
    <Panel title={t("conditions.heading")}>
      <ul className={styles.list}>
        {conditions.map(({ id, severity, since }) => (
          <li key={id}>
            {capitalise(
              t(since === 0 ? "conditions.lineFromBirth" : "conditions.line", {
                name: t(`condition.${id}`),
                severity: t(`severity.${severity}`),
                since,
              }),
            )}
          </li>
        ))}
      </ul>
      {helpTopics.map((topic) => (
        <HelpNote key={topic} topic={topic} />
      ))}
    </Panel>
  );
}

function relativeLine(relative: Relationship) {
  const kind = relative.kind === "sibling" ? `kind.sibling.${relative.sex}` : `kind.${relative.kind}`;
  const vars = { name: relative.name, kind: t(kind), age: relative.age };
  return t(relative.alive ? "life.relative.alive" : "life.relative.dead", vars);
}

function RelativeList({ relatives }: { relatives: readonly Relationship[] }) {
  if (relatives.length === 0) return null;
  return (
    <ul className={styles.list}>
      {relatives.map((relative) => (
        <li key={relative.id}>
          <div className={styles.relative}>
            <span>{relativeLine(relative)}</span>
            {relative.alive && <Closeness relative={relative} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Closeness({ relative }: { relative: Relationship }) {
  const word = t(`closeness.${closenessBand(relative.closeness)}`);
  return (
    <span className={styles.closeness}>
      {/* The word says it all to a screen reader; the bar is only a picture of it. */}
      <meter className={styles.meter} min={0} max={100} value={Math.round(relative.closeness)} aria-hidden="true" />
      <span>{word}</span>
    </span>
  );
}

function siblingsHeading(siblings: readonly Relationship[]): string {
  const living = siblings.filter((s) => s.alive).length;
  if (living > 0) return t(pluralKey("family.siblings", living), { count: living });
  return t(siblings.length === 0 ? "family.siblings.none" : "family.siblings.noneLiving");
}

export function FamilyPanel({ family }: { family: FamilySummary }) {
  const { parents, siblings, others } = family;
  return (
    <Panel title={t("life.family")}>
      {parents.length > 0 && (
        <>
          <h3 className={styles.group}>{t("family.parents")}</h3>
          <RelativeList relatives={parents} />
        </>
      )}
      <h3 className={styles.group}>{siblingsHeading(siblings)}</h3>
      <RelativeList relatives={siblings} />
      {others.length > 0 && (
        <>
          <h3 className={styles.group}>{t("family.others")}</h3>
          <RelativeList relatives={others} />
        </>
      )}
    </Panel>
  );
}
