import { t } from "../i18n";
import styles from "./Header.module.css";
import { HelpLink } from "./HelpNote";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
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
