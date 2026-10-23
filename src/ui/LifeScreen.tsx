import type { LifeState, StatId } from "../engine/types";
import { t } from "../i18n";
import { Header } from "./Header";
import styles from "./LifeScreen.module.css";
import { useFocusOnMount } from "./useFocusOnMount";

const STATS: readonly StatId[] = ["health", "wellbeing", "bonds", "skills"];

interface Props {
  life: LifeState;
  onContinue: () => void;
  onBack: () => void;
}

export function LifeScreen({ life, onContinue, onBack }: Props) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const { person } = life;
  const last = life.history.at(-1);
  const story = !last
    ? ""
    : last.stageChanged
      ? t("life.stageReached", { stage: t(`life.stage.${last.stage}`) })
      : t("life.yearPassed", { age: last.age });

  return (
    <section>
      <Header />
      <h1 ref={heading} tabIndex={-1}>
        {t("life.age", { age: person.age })}
        <span className="subtitle">{t(`life.stage.${person.stage}`)}</span>
      </h1>
      <dl className={styles.stats}>
        {STATS.map((id) => (
          <div key={id} className={styles.row}>
            <dt>{t(`life.stat.${id}`)}</dt>
            <dd>
              <meter
                className={styles.meter}
                min={0}
                max={100}
                value={person.stats[id]}
                aria-label={t(`life.stat.${id}`)}
              />
              <span className={styles.value}>{person.stats[id]}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.story} role="status">
        {story}
      </p>
      <div className={styles.actions}>
        <button type="button" className="primary" onClick={onContinue}>
          {t("life.continue")}
        </button>
        <button type="button" className="ghost" onClick={onBack}>
          {t("life.backToStart")}
        </button>
      </div>
    </section>
  );
}
