// Help resources (UI-012): the calm pointer to free helplines that follows a hard topic, and the link
// that is always at hand. No country-specific numbers are shipped because none can be verified; the
// link is an international directory.
import { useId } from "react";
import type { HelpTopic } from "../engine/types";
import { hasString, t } from "../i18n";
import styles from "./HelpNote.module.css";

export const HELP_URL = "https://findahelpline.com";

/** A link to the directory that opens in a new tab and says so to a screen reader. */
export function HelpLink({ children, className }: { children: string; className?: string }) {
  const hintId = useId();
  return (
    <>
      <a href={HELP_URL} target="_blank" rel="noopener noreferrer" aria-describedby={hintId} className={className}>
        {children}
      </a>
      {/* Hidden outright: it is only a description, so it is never read as content (or announced in a live region). */}
      <span id={hintId} hidden>
        {t("help.newTab")}
      </span>
    </>
  );
}

/** The help text for a topic with its link, shown with the event, decision or condition it belongs to. */
export function HelpNote({ topic }: { topic: HelpTopic }) {
  // A stored life may name a topic this version has no words for.
  if (!hasString(`help.${topic}`)) return null;
  return (
    <p className={styles.help}>
      {t(`help.${topic}`)} <HelpLink>{t("help.link")}</HelpLink>
    </p>
  );
}
