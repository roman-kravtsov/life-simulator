// A first-life hint (UI-015): a short note in the page, where the thing it explains is, with one button to put it away.
// It never moves focus, speaks or times itself out (TIME-001, A11Y-004): it is plain text the player reads when they
// like, and it stays until they say they have it, or until they do what it describes.
import { t } from "../i18n";
import styles from "./Hint.module.css";
import { Button } from "./kit";

interface Props {
  /** The hint lines to show, as string keys; a hint with more than one reads as one note with one button. */
  keys: readonly string[];
  /** Puts the hint away; the caller decides where focus goes, since this note is about to leave the page. */
  onDismiss: () => void;
}

export function Hint({ keys, onDismiss }: Props) {
  return (
    <div role="note" className={styles.hint}>
      <p className={`eyebrow ${styles.label}`}>{t("hint.label")}</p>
      {keys.map((key) => (
        <p key={key} className={styles.line}>
          {t(key)}
        </p>
      ))}
      <Button onPress={onDismiss}>{t("hint.dismiss")}</Button>
    </div>
  );
}
