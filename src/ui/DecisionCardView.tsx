// The decision card (UI-006, DEC-001, DEC-002, DEC-005, UI-012). The year stops here until the player
// answers. Each choice shows what it costs and the odds lens in words; a locked choice stays in view
// with the reason in text, tied to the button for screen readers. Focus moves to the heading when the
// card appears. The first time one is met it carries a hint (UI-015).
import { useId, useState } from "react";
import type { ChoiceView, DecisionCard } from "../engine/decisions";
import type { CountryIndex } from "../engine/world/types";
import { formatMoney } from "../format";
import { t } from "../i18n";
import { HelpNote } from "./HelpNote";
import { Hint } from "./Hint";
import { Button } from "./kit";
import styles from "./DecisionCardView.module.css";
import { useFocusOn } from "./useFocusOn";
import { dataNoteLine, oddsWords } from "./words";

function lensLine({ key, band, vsBand }: ChoiceView["lens"][number]): string {
  const line = t("lens.line", { what: t(key), odds: oddsWords(band) });
  return vsBand ? t("lens.vs", { line, odds: oddsWords(vsBand) }) : line;
}

function Choice({
  choice,
  onChoose,
  onLocked,
}: {
  choice: ChoiceView;
  onChoose: (choiceId: string) => void;
  onLocked: (reason: string) => void;
}) {
  const detailId = useId();
  const { lockedReason, cost, lens } = choice;
  const hasDetail = Boolean(lockedReason || cost || lens.length !== 0);
  return (
    <li className={styles.choice}>
      {/* A locked choice stays focusable (aria-disabled) so its reason can be found by keyboard and read. */}
      <Button
        variant="choice"
        aria-disabled={lockedReason ? true : undefined}
        aria-describedby={hasDetail ? detailId : undefined}
        onPress={
          lockedReason ? () => onLocked(t("decision.locked", { reason: t(lockedReason) })) : () => onChoose(choice.id)
        }
      >
        {t(choice.textKey)}
      </Button>
      {hasDetail && (
        <div id={detailId} className={styles.detail}>
          {lockedReason && <p className={styles.locked}>{t("decision.locked", { reason: t(lockedReason) })}</p>}
          {cost && (
            <p>
              {t(cost.perYear ? "decision.cost.perYear" : "decision.cost.once", { amount: formatMoney(cost.amount) })}
            </p>
          )}
          {lens.map((line, index) => (
            <p key={`${index}-${line.key}`}>{lensLine(line)}</p>
          ))}
        </div>
      )}
    </li>
  );
}

interface Props {
  card: DecisionCard;
  sources: CountryIndex["sources"];
  onChoose: (choiceId: string) => void;
  /** The string keys of the hints to show on this card, if any (UI-015). */
  hints?: readonly string[];
  /** The hint has been put away. */
  onHintDismiss?: () => void;
}

export function DecisionCardView({ card, sources, onChoose, hints = [], onHintDismiss }: Props) {
  const heading = useFocusOn<HTMLHeadingElement>(card.eventId);
  const choicesId = useId();
  const textId = useId();
  // Pressing a locked choice does nothing, so say why; the reason is also in its description.
  const [notice, setNotice] = useState({ text: "", presses: 0 });
  return (
    <section aria-labelledby={`${choicesId}-heading`} className={styles.card}>
      <h2
        id={`${choicesId}-heading`}
        ref={heading}
        tabIndex={-1}
        aria-describedby={textId}
        className={`eyebrow ${styles.heading}`}
      >
        {t("decision.heading")}
      </h2>
      <p id={textId} className={styles.text}>
        {t(card.textKey, card.vars)}
      </p>
      {card.dataNote && <p className={styles.dataNote}>{dataNoteLine(card.dataNote, sources)}</p>}
      {card.helpTopic && <HelpNote topic={card.helpTopic} />}
      {hints.length > 0 && (
        <Hint
          keys={hints}
          onDismiss={() => {
            onHintDismiss?.();
            // The note is leaving the page, so focus goes to the heading of the card it was on.
            heading.current?.focus();
          }}
        />
      )}
      <ul aria-label={t("decision.choices")} className={styles.choices}>
        {card.choices.map((choice) => (
          <Choice
            key={choice.id}
            choice={choice}
            onChoose={onChoose}
            onLocked={(text) => setNotice((before) => ({ text, presses: before.presses + 1 }))}
          />
        ))}
      </ul>
      <div aria-live="polite" className="visually-hidden">
        {/* A new node for every press, so pressing the same locked choice again is announced again. */}
        <span key={notice.presses}>{notice.text}</span>
      </div>
    </section>
  );
}
