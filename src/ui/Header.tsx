import { t } from "../i18n";
import styles from "./Header.module.css";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className={styles.header}>
      <span className={styles.wordmark}>{t("app.title")}</span>
      <ThemeToggle />
    </header>
  );
}
