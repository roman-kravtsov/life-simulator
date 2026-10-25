import { useMemo, useState } from "react";
import type { DecisionCard } from "../engine/decisions";
import type { CountryIndex, Country } from "../engine/world/types";
import type { LifeState, Plan, Settings, StatId } from "../engine/types";
import { countryName } from "../format";
import { t } from "../i18n";
import { DecisionCardView } from "./DecisionCardView";
import { EventLine } from "./EventLine";
import { Header } from "./Header";
import { Button } from "./kit";
import { ConditionsPanel, FamilyPanel, MoneyPanel, SchoolPanel, WorkPanel } from "./LifePanels";
import styles from "./LifeScreen.module.css";
import { PlanWidget } from "./PlanWidget";
import { SettingsPanel } from "./SettingsPanel";
import { lifeOverview, planToSend, type GameSnapshot, type PlanOverview, type QuietRun } from "./store";
import { useFocusOn } from "./useFocusOn";
import { quietRunLine } from "./words";

const STATS: readonly StatId[] = ["health", "happiness", "belonging", "skills"];

export interface LifeScreenProps {
  life: LifeState;
  country: Country;
  sources: CountryIndex["sources"];
  showUsPrices: boolean;
  /** The decision the year is waiting on, if any (DEC-001). */
  card: DecisionCard | null;
  /** The focus plan to place, if one is asked for this year (DEC-003). */
  plan: PlanOverview | null;
  /** Years that just passed in one step without anything to tell (TIME-002). */
  quietRun: QuietRun | null;
  /** Set when the life was resumed from something other than its saved copy (SAVE-005, RNG-004). */
  restored: GameSnapshot["restored"];
  /** Set when the browser would not keep this life, so it will be lost with the tab (SAVE-001). */
  problem: GameSnapshot["problem"];
  onToggleUsPrices: () => void;
  /** `plan` is set only when the player changed it; otherwise the plan carries over. */
  onContinue: (plan?: Plan) => void;
  onChoose: (choiceId: string) => void;
  onSettings: (changes: Partial<Settings>) => void;
  onBack: () => void;
}

export function LifeScreen({
  life,
  country,
  sources,
  showUsPrices,
  card,
  plan,
  quietRun,
  restored,
  problem,
  onToggleUsPrices,
  onContinue,
  onChoose,
  onSettings,
  onBack,
}: LifeScreenProps) {
  const { person } = life;
  // While a decision waits its card takes focus instead.
  const heading = useFocusOn<HTMLHeadingElement>(life.history.length, !card);
  // The player's unsent plan, kept only for the age it was made at, so a new year starts from the plan as it stands.
  const [edit, setEdit] = useState<{ age: number; draft: Plan } | null>(null);
  const draft = plan && edit?.age === person.age ? edit.draft : plan?.chosen;
  const last = life.history.at(-1);
  const story = !last
    ? ""
    : last.stageChanged
      ? t("life.stageReached", { stage: t(`life.stage.${last.stage}`) })
      : t("life.yearPassed", { age: last.age });
  const events = last?.events ?? [];
  // The panels only change with the life, not with a plan being placed.
  const { education, literacy, work, money, conditions, family } = useMemo(
    () => lifeOverview(life, country),
    [life, country],
  );

  // The next year, unless a decision is waiting. A life that ends is shown on the summary screen instead.
  const goOn = !card;
  const sendPlan = () => {
    onContinue(plan && draft ? planToSend(plan, draft) : undefined);
  };

  return (
    <section>
      <Header />
      <h1 ref={heading} tabIndex={-1}>
        {t("life.age", { age: person.age })}
        <span className="subtitle">{t(`life.stage.${person.stage}`)}</span>
      </h1>
      <p className="small">
        {t("life.where", { country: countryName(country), place: t(`life.place.${person.location}`) })}
      </p>
      {restored && (
        <p className="note" role="note">
          {t(`life.restored.${restored}`)}
        </p>
      )}
      {/* A save that fails mid-life is said politely, once; the notes above and below stay as they are. */}
      <div aria-live="polite">
        {problem === "current" && (
          <p className="note" role="note">
            {t("life.problem.current")}
          </p>
        )}
      </div>
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
      <div role="status">
        {quietRun && <p className={styles.storyLine}>{quietRunLine(quietRun)}</p>}
        {card ? (
          <p className={styles.storyLine}>{t("decision.waiting")}</p>
        ) : (
          <>
            <p className={styles.storyLine}>{story}</p>
            {last && (
              <>
                <h2 className={`eyebrow ${styles.sectionHeading}`}>{t("life.thisYear")}</h2>
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
          </>
        )}
      </div>
      {card && <DecisionCardView key={card.eventId} card={card} sources={sources} onChoose={onChoose} />}
      {plan && draft && !card && (
        <PlanWidget plan={plan} draft={draft} onChange={(next) => setEdit({ age: person.age, draft: next })} />
      )}
      <div className={styles.actions}>
        {goOn && (
          <Button variant="primary" onPress={sendPlan}>
            {t("life.continue")}
          </Button>
        )}
        <Button onPress={onBack}>{t("life.backToStart")}</Button>
      </div>
      <SchoolPanel education={education} literacy={literacy} />
      {work && <WorkPanel work={work} />}
      <MoneyPanel money={money} showUsPrices={showUsPrices} onToggleUsPrices={onToggleUsPrices} />
      {conditions.length > 0 && <ConditionsPanel conditions={conditions} />}
      <FamilyPanel family={family} />
      <SettingsPanel settings={life.settings} onChange={onSettings} />
    </section>
  );
}
