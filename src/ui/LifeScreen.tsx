import type { CountryIndex, Country } from "../engine/world/types";
import type { EventRecord, LifeState, StatId } from "../engine/types";
import { countryName, formatPercent } from "../format";
import { hasString, t } from "../i18n";
import { Header } from "./Header";
import { Button } from "./kit";
import { ConditionsPanel, FamilyPanel, MoneyPanel, SchoolPanel, WorkPanel } from "./LifePanels";
import styles from "./LifeScreen.module.css";
import { lifeOverview } from "./store";
import { useFocusOn } from "./useFocusOn";

const STATS: readonly StatId[] = ["health", "happiness", "belonging", "skills"];

interface Props {
  life: LifeState;
  country: Country;
  sources: CountryIndex["sources"];
  showUsPrices: boolean;
  onToggleUsPrices: () => void;
  onContinue: () => void;
  onAnother: () => void;
  onBack: () => void;
}

function EventLine({ event, sources }: { event: EventRecord; sources: CountryIndex["sources"] }) {
  const { dataNote } = event;
  return (
    <li>
      {t(event.textKey, event.vars)}
      {dataNote && (
        <span className={styles.dataNote}>
          {" "}
          {t("life.note", {
            note: t(dataNote.textKey, { share: formatPercent(dataNote.value) }),
            source: sources[dataNote.source]?.title ?? dataNote.source,
            year: dataNote.year,
          })}
        </span>
      )}
      {event.helpTopic && (
        <p className={styles.help}>
          {t(`help.${event.helpTopic}`)}{" "}
          <a href="https://findahelpline.com" rel="noopener">
            {t("help.link")}
          </a>
        </p>
      )}
    </li>
  );
}

export function LifeScreen({
  life,
  country,
  sources,
  showUsPrices,
  onToggleUsPrices,
  onContinue,
  onAnother,
  onBack,
}: Props) {
  const { person, death } = life;
  const heading = useFocusOn<HTMLHeadingElement>(life.history.length);
  const last = life.history.at(-1);
  const story = death
    ? t("life.died", {
        age: death.age,
        cause: t(hasString(`cause.${death.cause}`) ? `cause.${death.cause}` : "cause.other"),
      })
    : !last
      ? ""
      : last.stageChanged
        ? t("life.stageReached", { stage: t(`life.stage.${last.stage}`) })
        : t("life.yearPassed", { age: last.age });
  const events = last?.events ?? [];
  const { education, literacy, work, money, conditions, family } = lifeOverview(life, country);

  return (
    <section>
      <Header />
      <h1 ref={heading} tabIndex={-1}>
        {t("life.age", { age: person.age })}
        <span className="subtitle">{person.alive ? t(`life.stage.${person.stage}`) : t("life.ended")}</span>
      </h1>
      <p className="small">
        {t("life.where", { country: countryName(country), place: t(`life.place.${person.location}`) })}
      </p>
      <dl className={styles.stats}>
        {STATS.map((id) => (
          <div key={id} className={styles.row}>
            <dt>{t(`life.stat.${id}`)}</dt>
            <dd>
              <meter
                className={styles.meter}
                min={0}
                max={100}
                value={Math.round(person.stats[id])}
                aria-label={t(`life.stat.${id}`)}
              />
              <span className={styles.value}>{Math.round(person.stats[id])}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div role="status" className={styles.story}>
        <p>{story}</p>
        {last && (
          <>
            <h2 className={styles.sectionHeading}>{t("life.thisYear")}</h2>
            {events.length === 0 ? (
              <p>{t("life.quietYear")}</p>
            ) : (
              <ul className={styles.events}>
                {events.map((event, index) => (
                  <EventLine key={`${index}-${event.id}`} event={event} sources={sources} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <div className={styles.actions}>
        {person.alive ? (
          <Button variant="primary" onPress={onContinue}>
            {t("life.continue")}
          </Button>
        ) : (
          <Button variant="primary" onPress={onAnother}>
            {t("life.another")}
          </Button>
        )}
        <Button onPress={onBack}>{t("life.backToStart")}</Button>
      </div>
      <SchoolPanel education={education} literacy={literacy} />
      {work && <WorkPanel work={work} />}
      <MoneyPanel money={money} showUsPrices={showUsPrices} onToggleUsPrices={onToggleUsPrices} />
      {conditions.length > 0 && <ConditionsPanel conditions={conditions} />}
      <FamilyPanel family={family} />
    </section>
  );
}
