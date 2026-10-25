// The header of the life screen (UI-004, UI-010, UI-012): stays at the top while the page scrolls. It has the
// wordmark, who the person is and where, the Journal, the settings, the always-there help link and Continue, and, in
// the wide layout, the strip that shows the life from birth to about eighty with a dot for each key moment.
// In the narrow layout it keeps only the wordmark, the help link, Settings and Continue; the name and place move into the
// story and the Journal into the tabs.
import { useId } from "react";
import type { Settings } from "../engine/types";
import { t } from "../i18n";
import { HelpLink } from "./HelpNote";
import { Button, Dialog } from "./kit";
import styles from "./LifeHeader.module.css";
import { SettingsPanel } from "./SettingsPanel";
import type { LifeStrip } from "./store";
import { ThemeToggle } from "./ThemeToggle";

/** Where an age is on the strip, as a share of its length. */
const at = (age: number, end: number) => `${Math.min(100, (age / end) * 100)}%`;

function Strip({ strip }: { strip: LifeStrip }) {
  const { age, end, moments } = strip;
  return (
    <div className={styles.strip}>
      <span>{t("life.strip.birth")}</span>
      {/* Drawn with attributes, not styles; the dots and the marker are shapes, so they read without their colour. */}
      <svg
        className={styles.track}
        role="img"
        aria-label={t("life.strip.label", { age, end })}
        height="14"
        width="100%"
      >
        <rect className={styles.line} x="0" y="5" width="100%" height="4" rx="2" />
        <rect className={styles.filled} x="0" y="5" width={at(age, end)} height="4" rx="2" />
        {moments.map((moment) => (
          <circle key={moment} data-moment={moment} className={styles.moment} cx={at(moment, end)} cy="7" r="3.5" />
        ))}
        <circle data-now="" className={styles.now} cx={at(age, end)} cy="7" r="6" />
      </svg>
      <span>{t("life.strip.end", { age: end })}</span>
    </div>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 16 1-4 8-8 3 3-8 8z" />
    </svg>
  );
}

interface Props {
  name: string;
  age: number;
  /** "Country, place" as the story gives it. */
  where: string;
  strip: LifeStrip;
  /** The narrow layout: no name line, strip or Journal button. */
  narrow: boolean;
  /** True while a decision waits; Continue then stays, but is not available. */
  waiting: boolean;
  settings: Settings;
  onSettings: (changes: Partial<Settings>) => void;
  onJournal: () => void;
  onContinue: () => void;
  onBack: () => void;
}

export function LifeHeader({
  name,
  age,
  where,
  strip,
  narrow,
  waiting,
  settings,
  onSettings,
  onJournal,
  onContinue,
  onBack,
}: Props) {
  const whyId = useId();
  return (
    <header className={`${styles.header} ${narrow ? styles.narrow : ""}`}>
      <div className={styles.row}>
        <span className={styles.wordmark}>{t("app.title")}</span>
        {!narrow && (
          <div className={styles.who}>
            <span className={styles.name}>{name}</span>
            <span>{t("life.who.line", { age, where })}</span>
          </div>
        )}
        <div className={styles.tools}>
          {!narrow && (
            <Button onPress={onJournal}>
              <span className={styles.withIcon}>
                <PenIcon />
                {t("life.journal")}
              </span>
            </Button>
          )}
          <Dialog
            title={t("life.settings")}
            closeLabel={t("life.settings.close")}
            trigger={
              <Button icon aria-label={t("life.settings")}>
                <GearIcon />
              </Button>
            }
          >
            <SettingsPanel settings={settings} onChange={onSettings} />
            <div className={styles.dialogRow}>
              <span>{t("life.settings.theme")}</span>
              <ThemeToggle />
            </div>
            <div className={styles.dialogRow}>
              <Button onPress={onBack}>{t("life.backToStart")}</Button>
            </div>
          </Dialog>
          {/* On every screen, so help is one tab away whatever is happening (UI-012). */}
          <HelpLink className={styles.talk}>{t("help.talk")}</HelpLink>
          {/* While a decision waits it stays, can be reached and pressed, and does nothing: the reason is its description. */}
          <Button
            variant="primary"
            aria-label={t("life.continue")}
            aria-disabled={waiting ? true : undefined}
            aria-describedby={waiting ? whyId : undefined}
            onPress={waiting ? undefined : onContinue}
          >
            {t("life.continue.short")}
          </Button>
          {waiting && (
            <span id={whyId} hidden>
              {t("life.continue.wait")}
            </span>
          )}
        </div>
      </div>
      {!narrow && <Strip strip={strip} />}
    </header>
  );
}
