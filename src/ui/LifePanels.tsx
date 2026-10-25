// The panels of the life screen's side columns: school and work, money and health conditions beside the person,
// family and country around them. Each one is the content of a tab, so the tab's name is its name, and each reads as
// plain lists and terms for a screen reader. They only display what `lifeOverview` and `countryFacts` (store.ts) derive.
import type { ReactNode } from "react";
import type { HelpTopic, Relationship, Sex } from "../engine/types";
import type { Country, CountryIndex } from "../engine/world/types";
import { capitalise, countryName, formatMoney, formatNumber, formatPercent, pluralKey } from "../format";
import { t } from "../i18n";
import { HelpNote } from "./HelpNote";
import { Button, Dialog, Switch } from "./kit";
import styles from "./LifePanels.module.css";
import {
  closenessBand,
  type CountryFacts,
  type EducationSummary,
  type FamilySummary,
  type LifeOverview,
  type MoneySummary,
  type WorkSummary,
} from "./store";
import { sourceTitle, yearsWords } from "./words";

/** A term and what it says. `inline` puts them on one line (label left, value right) for short values. */
function Fact({ label, inline = false, children }: { label: string; inline?: boolean; children: ReactNode }) {
  return (
    <div className={inline ? `${styles.fact} ${styles.inline}` : styles.fact}>
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

function workStatus(work: WorkSummary): string {
  if (work.kind !== "working") return t(`work.status.${work.kind}`);
  const terms = t(work.formal ? "work.terms.formal" : "work.terms.informal");
  return work.sector
    ? t("work.status.working", { sector: t(`work.sector.${work.sector}`), terms })
    : t("work.status.working.nosector", { terms });
}

interface SchoolWorkProps {
  education: EducationSummary;
  literacy: LifeOverview["literacy"];
  /** Null under age six: there is nothing to say about work yet. */
  work: WorkSummary | null;
}

/** School (EDU-001, EDU-002) and work (CAREER-001, CAREER-002, CAREER-006) together. */
export function SchoolWorkPanel({ education, literacy, work }: SchoolWorkProps) {
  const schooled = education.kind !== "too-young" && education.kind !== "never";
  return (
    <dl className={styles.facts}>
      <Fact label={t("school.field.level")}>{schoolStatus(education)}</Fact>
      {schooled && education.years > 0 && (
        <Fact label={t("school.field.years")} inline>
          {years(education.years)}
        </Fact>
      )}
      {literacy && <Fact label={t("school.field.reading")}>{t(`school.reading.${literacy}`)}</Fact>}
      {work && <Fact label={t("work.field.status")}>{workStatus(work)}</Fact>}
      {work && work.yearsWorked > 0 && (
        <Fact label={t("work.field.years")} inline>
          {years(work.yearsWorked)}
        </Fact>
      )}
    </dl>
  );
}

/** An amount that rounds to zero dollars counts as nothing. */
const isNothing = (amount: number) => Math.round(amount) === 0;

interface MoneyPanelProps {
  money: MoneySummary;
  showUsPrices: boolean;
  onToggleUsPrices: () => void;
}

/** Income, savings and debt (MONEY-002, MONEY-004) and the comparison with US prices (MONEY-007). */
export function MoneyPanel({ money, showUsPrices, onToggleUsPrices }: MoneyPanelProps) {
  const who = money.own ? "own" : "household";
  const { holdings } = money;
  const hasHoldings = holdings !== null && !(isNothing(holdings.savings) && isNothing(holdings.debt));
  return (
    <>
      <dl className={styles.facts}>
        <Fact label={t(`money.field.daily.${who}`)} inline>
          {formatMoney(money.daily)}
        </Fact>
        <Fact label={t(`money.field.yearly.${who}`)} inline>
          {formatMoney(money.yearly)}
        </Fact>
        <Fact label={t("money.field.band")}>{capitalise(t(`money.band.${money.band}`))}</Fact>
        {holdings && hasHoldings && (
          <>
            <Fact label={t("money.field.savings")} inline>
              {formatMoney(holdings.savings)}
            </Fact>
            <Fact label={t("money.field.debt")} inline>
              {formatMoney(holdings.debt)}
            </Fact>
          </>
        )}
        {holdings && !hasHoldings && <Fact label={t("money.field.holdings")}>{t("money.none")}</Fact>}
      </dl>
      {/* The lines come before the switch, the panel's only control, so a keyboard player who reaches it has passed
          them all, even when large text makes the panel scroll. */}
      <p className={`small ${styles.note}`}>{t("money.note", { year: money.year })}</p>
      {/* Always present, so a screen reader hears the text arrive when the switch is turned on. */}
      <p className={`small ${styles.note}`} aria-live="polite">
        {showUsPrices && t("money.usComparison")}
      </p>
      <Switch isSelected={showUsPrices} onChange={() => onToggleUsPrices()}>
        {t("money.usSwitch")}
      </Switch>
    </>
  );
}

/** Each help topic once, however many of the conditions point to it. */
function helpTopicsOf(conditions: LifeOverview["conditions"]) {
  const topics = new Set<HelpTopic>();
  for (const { helpTopic } of conditions) if (helpTopic) topics.add(helpTopic);
  return [...topics];
}

/** The lasting conditions (HEALTH-004), with the help that goes with the hard ones for as long as they last. */
export function HealthPanel({ conditions }: { conditions: LifeOverview["conditions"] }) {
  if (conditions.length === 0) return <p>{t("conditions.none")}</p>;
  return (
    <div className={styles.health}>
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
      {helpTopicsOf(conditions).map((topic) => (
        <HelpNote key={topic} topic={topic} />
      ))}
    </div>
  );
}

function relativeLine(relative: Relationship) {
  const kind = relative.kind === "sibling" ? `kind.sibling.${relative.sex}` : `kind.${relative.kind}`;
  const vars = { name: relative.name, kind: t(kind), age: relative.age };
  return t(relative.alive ? "life.relative.alive" : "life.relative.dead", vars);
}

function Closeness({ relative }: { relative: Relationship }) {
  const word = t(`closeness.${closenessBand(relative.closeness)}`);
  return (
    <span className={styles.closeness}>
      {/* The word says it all to a screen reader; the bar is only a picture of it. */}
      <meter className={styles.meter} min={0} max={100} value={Math.round(relative.closeness)} aria-hidden="true" />
      <span className={styles.word}>{word}</span>
    </span>
  );
}

/** One line a person: who they are to you and how old, then how close, as a word and a small bar. */
function RelativeList({ relatives }: { relatives: readonly Relationship[] }) {
  if (relatives.length === 0) return null;
  return (
    <ul className={styles.people}>
      {relatives.map((relative) => (
        <li key={relative.id} className={styles.person}>
          <span>{relativeLine(relative)}</span>
          {relative.alive && <Closeness relative={relative} />}
        </li>
      ))}
    </ul>
  );
}

function siblingsHeading(siblings: readonly Relationship[]): string {
  const living = siblings.filter((s) => s.alive).length;
  if (living > 0) return t(pluralKey("family.siblings", living), { count: living });
  return t(siblings.length === 0 ? "family.siblings.none" : "family.siblings.noneLiving");
}

/** Most people the Family tab lists, so the tab fits a short window however large the family (UI-004). */
const FAMILY_SHOWN = 8;

/** The people the tab has room for when there are too many: the living first, then in the order of the groups. */
function shownOf({ parents, siblings, others }: FamilySummary): Set<Relationship> | null {
  const everyone = [...parents, ...siblings, ...others];
  if (everyone.length <= FAMILY_SHOWN) return null;
  const living = everyone.filter((r) => r.alive);
  const dead = everyone.filter((r) => !r.alive);
  return new Set([...living, ...dead].slice(0, FAMILY_SHOWN));
}

interface GroupsProps {
  family: FamilySummary;
  /** Only these people, in their groups; everyone when absent. */
  shown?: Set<Relationship> | null;
}

/**
 * The groups, each with its heading (h3, in the tab and under the dialog's h2 title), even when none of its people has
 * room; the siblings heading counts them all.
 */
function FamilyGroups({ family, shown }: GroupsProps) {
  const { parents, siblings, others } = family;
  const only = (people: readonly Relationship[]) => (shown ? people.filter((r) => shown.has(r)) : people);
  return (
    <>
      {parents.length > 0 && (
        <>
          <h3 className={styles.group}>{t("family.parents")}</h3>
          <RelativeList relatives={only(parents)} />
        </>
      )}
      <h3 className={styles.group}>{siblingsHeading(siblings)}</h3>
      <RelativeList relatives={only(siblings)} />
      {others.length > 0 && (
        <>
          <h3 className={styles.group}>{t("family.others")}</h3>
          <RelativeList relatives={only(others)} />
        </>
      )}
    </>
  );
}

/**
 * Parents, brothers and sisters, and the others in the life (REL-001, FAM-002). A large family shows eight people
 * and a button that opens everyone in a dialog, so the tab never has to scroll.
 */
export function FamilyPanel({ family }: { family: FamilySummary }) {
  const shown = shownOf(family);
  const total = family.parents.length + family.siblings.length + family.others.length;
  const hidden = shown ? total - shown.size : 0;
  return (
    <>
      <FamilyGroups family={family} shown={shown} />
      {hidden > 0 && (
        <div className={styles.more}>
          <Dialog
            title={t("family.all.title")}
            closeLabel={t("family.all.close")}
            trigger={<Button>{t(pluralKey("family.more", hidden), { count: formatNumber(hidden) })}</Button>}
          >
            <FamilyGroups family={family} />
          </Dialog>
        </div>
      )}
    </>
  );
}

interface CountryPanelProps {
  facts: CountryFacts;
  sex: Sex;
  country: Pick<Country, "iso2" | "name">;
  sources: CountryIndex["sources"];
}

/** A few measured facts about the country, each with its source and year. Estimated values are never here. */
export function CountryPanel({ facts, sex, country, sources }: CountryPanelProps) {
  const { lifeExpectancy, upperSecondary, middleIncome } = facts;
  const source = (fact: { source: string; year: number }) => (
    <span className={styles.source}>
      {t("country.source", { source: sourceTitle(fact.source, sources), year: fact.year })}
    </span>
  );
  const none = !lifeExpectancy && !upperSecondary && !middleIncome;
  return (
    <>
      <p className="small">{t("country.intro", { country: countryName(country) })}</p>
      {none ? (
        <p>{t("country.none")}</p>
      ) : (
        <dl className={styles.facts}>
          {lifeExpectancy && (
            <Fact label={t(`country.lifeExpectancy.${sex}`)}>
              {t("country.lifeExpectancy.value", { years: yearsWords(Math.round(lifeExpectancy.years)) })}
              {source(lifeExpectancy)}
            </Fact>
          )}
          {upperSecondary && (
            <Fact label={t(`country.upperSecondary.${sex}`)}>
              {formatPercent(upperSecondary.share)}
              {source(upperSecondary)}
            </Fact>
          )}
          {middleIncome && (
            <Fact label={t("country.income")}>
              {formatMoney(middleIncome.daily)}
              {source(middleIncome)}
            </Fact>
          )}
        </dl>
      )}
    </>
  );
}
