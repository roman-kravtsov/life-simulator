// The two settings that shape a life (EVENT-006, TIME-002). Shown before a life begins and, under the
// other panels, during it; changing one applies from the next year on.
import { useId } from "react";
import type { Settings } from "../engine/types";
import { t } from "../i18n";
import { Switch } from "./kit";
import styles from "./SettingsPanel.module.css";

interface Props {
  settings: Settings;
  onChange: (changes: Partial<Settings>) => void;
  /** A line under the heading on when the settings apply, where that needs saying (the settings screen). */
  about?: string;
  /** 2 on a page; 3 in the life screen's settings dialog, under its title. */
  headingLevel?: 2 | 3;
}

export function SettingsPanel({ settings, onChange, about, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const headingId = useId();
  const softeningAbout = useId();
  const paceAbout = useId();
  return (
    <section aria-labelledby={headingId} className={styles.settings}>
      <Heading id={headingId} className={`eyebrow ${styles.heading}`}>
        {t("settings.heading")}
      </Heading>
      {about && <p className={`small ${styles.about}`}>{about}</p>}
      <div className={styles.setting}>
        <Switch
          isSelected={settings.softening}
          onChange={(softening) => onChange({ softening })}
          aria-describedby={softeningAbout}
        >
          {t("settings.softening")}
        </Switch>
        <p id={softeningAbout} className="small">
          {t("settings.softening.about")}
        </p>
      </div>
      <div className={styles.setting}>
        <Switch
          isSelected={settings.pace === "quiet-years"}
          onChange={(skip) => onChange({ pace: skip ? "quiet-years" : "every-year" })}
          aria-describedby={paceAbout}
        >
          {t("settings.pace")}
        </Switch>
        <p id={paceAbout} className="small">
          {t("settings.pace.about")}
        </p>
      </div>
    </section>
  );
}
