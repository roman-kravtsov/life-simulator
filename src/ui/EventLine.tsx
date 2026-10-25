// One event of a year as a list item: its text, the choice the player made and what came of it, the data note
// with its source, and the help that follows a hard topic. Shared by the life screen and the summary. A stored
// life may name text this version no longer has: what cannot be told is left out, never thrown over.
import type { CountryIndex } from "../engine/world/types";
import type { EventRecord } from "../engine/types";
import { t } from "../i18n";
import styles from "./EventLine.module.css";
import { HelpNote } from "./HelpNote";
import { dataNoteLine, tryT } from "./words";

type Vars = EventRecord["vars"];

/** "You chose: ..." and what came of it, for a decision made in a year; nothing when either is gone. */
export function DecisionLine({ decision, vars }: { decision: NonNullable<EventRecord["decision"]>; vars: Vars }) {
  const choice = tryT(decision.choiceTextKey, vars);
  const outcome = tryT(decision.outcomeTextKey, vars);
  if (choice === null || outcome === null) return null;
  return (
    <>
      <span className={styles.chose}>{t("decision.chose", { choice })}</span>
      {outcome}
    </>
  );
}

export function EventLine({ event, sources }: { event: EventRecord; sources: CountryIndex["sources"] }) {
  const { dataNote, decision } = event;
  const text = tryT(event.textKey, event.vars);
  if (text === null) return null;
  const note = dataNote ? tryNote(dataNote, sources) : null;
  return (
    <li>
      {text}
      {decision && <DecisionLine decision={decision} vars={event.vars} />}
      {note && <span className={styles.dataNote}> {note}</span>}
      {event.helpTopic && <HelpNote topic={event.helpTopic} />}
    </li>
  );
}

function tryNote(note: NonNullable<EventRecord["dataNote"]>, sources: CountryIndex["sources"]): string | null {
  try {
    return dataNoteLine(note, sources);
  } catch {
    return null;
  }
}
