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
}

export function SettingsPanel({ settings, onChange }: Props) {
  const headingId = useId();
  const softeningAbout = useId();
  const paceAbout = useId();
  return (
    <section aria-labelledby={headingId} className={styles.settings}>
      <h2 id={headingId} className={styles.heading}>
        {t("settings.heading")}
      </h2>
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
