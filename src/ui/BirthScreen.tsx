import { dailyIncome, householdBand } from "../engine/money";
import type { LifeState } from "../engine/types";
import type { Country } from "../engine/world/types";
import { countryName, formatMoney } from "../format";
import { t } from "../i18n";
import styles from "./BirthScreen.module.css";
import { Header } from "./Header";
import { Button } from "./kit";
import { useFocusOn } from "./useFocusOn";

interface Props {
  life: LifeState;
  country: Country;
  onContinue: () => void;
}

/** CHAR-001: every field of the new person, in words. */
export function BirthScreen({ life, country, onContinue }: Props) {
  const { person, seed } = life;
  const heading = useFocusOn<HTMLHeadingElement>();
  const place = countryName(country);
  const mother = person.relationships.find((r) => r.kind === "mother")!;
  const father = person.relationships.find((r) => r.kind === "father")!;
  const income = dailyIncome(country, person.money.householdPercentile);

  return (
    <section>
      <Header />
      <h1 ref={heading} tabIndex={-1}>
        {t("birth.title", { country: place })}
        <span className="subtitle">{t("birth.year", { year: person.birthYear })}</span>
      </h1>
      <p className={styles.story}>
        {t("birth.you", { name: person.name, sex: t(`birth.sex.${person.sex}`) })} {t(`birth.place.${person.location}`)}
      </p>
      <p className={styles.story}>
        {t("birth.household", {
          band: t(`birth.band.${householdBand(person.money.householdPercentile)}`),
          country: place,
          income: formatMoney(income),
          year: country.money.percentiles.year,
        })}
      </p>
      <p className={styles.story}>
        {t("birth.parents", {
          mother: mother.name,
          motherAge: mother.age,
          father: father.name,
          fatherAge: father.age,
        })}
      </p>
      <p className="small">{t("birth.seed", { seed })}</p>
      <Button variant="primary" onPress={onContinue}>
        {t("birth.continue")}
      </Button>
    </section>
  );
}
