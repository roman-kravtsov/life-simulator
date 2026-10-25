// One event of a year as a list item: its text, the choice the player made and what came of it, the data note
// with its source, and the help that follows a hard topic. Shared by the life screen and the summary.
import type { CountryIndex } from "../engine/world/types";
import type { EventRecord } from "../engine/types";
import { t } from "../i18n";
import styles from "./EventLine.module.css";
import { HelpNote } from "./HelpNote";
import { dataNoteLine } from "./words";

type Vars = EventRecord["vars"];

/** "You chose: ..." and what came of it, for a decision made in a year. */
export function DecisionLine({ decision, vars }: { decision: NonNullable<EventRecord["decision"]>; vars: Vars }) {
  return (
    <>
      <span className={styles.chose}>{t("decision.chose", { choice: t(decision.choiceTextKey, vars) })}</span>
      {t(decision.outcomeTextKey, vars)}
    </>
  );
}

export function EventLine({ event, sources }: { event: EventRecord; sources: CountryIndex["sources"] }) {
  const { dataNote, decision } = event;
  return (
    <li>
      {t(event.textKey, event.vars)}
      {decision && <DecisionLine decision={decision} vars={event.vars} />}
      {dataNote && <span className={styles.dataNote}> {dataNoteLine(dataNote, sources)}</span>}
      {event.helpTopic && <HelpNote topic={event.helpTopic} />}
    </li>
  );
}
