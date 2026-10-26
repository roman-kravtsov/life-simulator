// The birth (UI-003, CHAR-001): who the new person is, where, into what household and to whom, in prose, then a few
// measured facts about the country with their sources (WORLD-008), the same panel as the life screen's Country tab.
import { useId, useMemo } from "react";
import type { LifeState } from "../engine/types";
import type { Country, CountryIndex } from "../engine/world/types";
import { countryName, formatMoney, formatNumber, pluralKey } from "../format";
import { t } from "../i18n";
import styles from "./BirthScreen.module.css";
import { Button } from "./kit";
import { CountryPanel } from "./LifePanels";
import { Page } from "./Page";
import { SiteHeader } from "./SiteHeader";
import { birthSummary, countryFacts } from "./store";
import { useFocusOn } from "./useFocusOn";

interface Props {
  life: LifeState;
  country: Country;
  /** Source details, for the source and year under each fact about the country. */
  sources: CountryIndex["sources"];
  /** True when the reveal of the country was left out for reduced motion, so this says how it was drawn (UI-016). */
  chanceNote?: boolean;
  onContinue: () => void;
  /** Back to the start; the life is already saved, so the start screen offers to continue it. */
  onBack: () => void;
}

/** Older brothers and sisters, said plainly for a first child too. */
const siblingsLine = (count: number) =>
  t(count === 0 ? "birth.siblings.none" : pluralKey("birth.siblings", count), { count: formatNumber(count) });

export function BirthScreen({ life, country, sources, chanceNote = false, onContinue, onBack }: Props) {
  const { person, seed } = life;
  const heading = useFocusOn<HTMLHeadingElement>();
  const countryHeading = useId();
  const place = countryName(country);
  const { band, income, incomeYear, mother, father, siblings } = birthSummary(life, country);
  const facts = useMemo(() => countryFacts(person.sex, country), [person.sex, country]);

  return (
    <Page header={<SiteHeader />}>
      <h1 ref={heading} tabIndex={-1}>
        {t("birth.title", { country: place })}
        <span className="subtitle">{t("birth.year", { year: person.birthYear })}</span>
      </h1>
      {chanceNote && <p className={`small ${styles.paragraph}`}>{t("reveal.chanceNote")}</p>}
      <p className={styles.paragraph}>
        {t("birth.you", { name: person.name, sex: t(`birth.sex.${person.sex}`) })} {t(`birth.place.${person.location}`)}
      </p>
      <p className={styles.paragraph}>
        {t("birth.household", {
          band: t(`birth.band.${band}`),
          country: place,
          income: formatMoney(income),
          year: incomeYear,
        })}
      </p>
      <p className={styles.paragraph}>
        {t("birth.parents", {
          mother: mother.name,
          motherAge: mother.age,
          father: father.name,
          fatherAge: father.age,
        })}{" "}
        {siblingsLine(siblings)}
      </p>
      <section aria-labelledby={countryHeading} className={styles.country}>
        <h2 id={countryHeading} className={`eyebrow ${styles.countryHeading}`}>
          {t("birth.country")}
        </h2>
        <CountryPanel facts={facts} sex={person.sex} country={country} sources={sources} />
      </section>
      <div className={styles.end}>
        <Button variant="primary" onPress={onContinue}>
          {t("birth.continue")}
        </Button>
        <p className="small">{t("birth.seed", { seed })}</p>
      </div>
      {/* Quiet, and after Begin: the life is already saved, so the start screen offers to continue it. */}
      <div className={styles.back}>
        <Button onPress={onBack}>{t("birth.back")}</Button>
      </div>
    </Page>
  );
}
