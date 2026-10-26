// The header of every screen but the life screen, which has its own (LifeHeader): the wordmark, the help link and the
// quick light-or-dark toggle. It goes in Page's header slot, outside <main>, so it is the page's banner.
import { t } from "../i18n";
import { HelpLink } from "./HelpNote";
import styles from "./SiteHeader.module.css";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <span className={styles.wordmark}>{t("app.title")}</span>
      <div className={styles.tools}>
        {/* On every screen, so help is one tab away whatever is happening (UI-012). */}
        <HelpLink className={styles.talk}>{t("help.talk")}</HelpLink>
        <ThemeToggle />
      </div>
    </header>
  );
}
