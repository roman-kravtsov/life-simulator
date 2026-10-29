// The settings (UI-009), from the start screen: how you want to play (for the lives you begin from now), how the page
// looks (theme, text size, motion: A11Y-004, A11Y-005), whether to bring back the first-life hints (UI-015) and what is
// stored on this device, which can all be deleted.
import { useId, useState } from "react";
import type { Settings } from "../engine/types";
import { t } from "../i18n";
import { DeleteAllData } from "./DeleteAllData";
import { displayStore, type DisplayStore } from "./display";
import { DisplaySettings } from "./DisplaySettings";
import { hintStore, type HintStore } from "./hints";
import { HintSettings } from "./HintSettings";
import { Button } from "./kit";
import { LifeFiles, type SaveText } from "./LifeFiles";
import { Page } from "./Page";
import { SettingsPanel } from "./SettingsPanel";
import styles from "./SettingsScreen.module.css";
import { SiteHeader } from "./SiteHeader";
import type { GameStore } from "./store";
import { useFocusOn } from "./useFocusOn";

export interface SettingsScreenProps {
  settings: Settings;
  onSettings: (changes: Partial<Settings>) => void;
  /** Whether anything may be stored to delete: false only when the game knows there is nothing. */
  canDeleteAll: boolean;
  /** Resolves true only when everything was deleted; the store then shows the start screen, which says so. */
  onDeleteAll: GameStore["deleteAllData"];
  /** Lives as files (SAVE-006). */
  /** Whether a life in progress is stored, to be saved to a file. */
  canExportCurrent: boolean;
  onExportCurrent: GameStore["exportCurrent"];
  onImport: GameStore["importLife"];
  onBack: () => void;
  /** Injected in tests; the page's own display preferences otherwise. */
  display?: DisplayStore;
  /** Injected in tests; the page's own first-life hints otherwise (UI-015). */
  hints?: HintStore;
  /** Injected in tests; the browser's download otherwise. */
  save?: SaveText;
}

export function SettingsScreen({
  settings,
  onSettings,
  canDeleteAll,
  onDeleteAll,
  canExportCurrent,
  onExportCurrent,
  onImport,
  onBack,
  display = displayStore,
  hints = hintStore,
  save,
}: SettingsScreenProps) {
  const heading = useFocusOn<HTMLHeadingElement>();
  const storedHeading = useId();
  // Said in the one status region when deleting fails; on success the start screen says so.
  const [failed, setFailed] = useState(0);
  async function removeAll() {
    setFailed(0);
    if (!(await onDeleteAll())) setFailed((count) => count + 1);
  }
  return (
    <Page header={<SiteHeader />}>
      <h1 ref={heading} tabIndex={-1}>
        {t("settingsScreen.title")}
      </h1>
      <div className={styles.part}>
        <SettingsPanel settings={settings} onChange={onSettings} about={t("settingsScreen.play.about")} />
      </div>
      <div className={styles.part}>
        <DisplaySettings store={display} />
      </div>
      <div className={styles.part}>
        <HintSettings store={hints} />
      </div>
      <section aria-labelledby={storedHeading} className={`${styles.part} ${styles.stored}`}>
        <h2 id={storedHeading} className={`eyebrow ${styles.heading}`}>
          {t("settingsScreen.stored")}
        </h2>
        <p className="small">{t("settingsScreen.stored.about")}</p>
        <LifeFiles
          canExportCurrent={canExportCurrent}
          onExportCurrent={onExportCurrent}
          onImport={onImport}
          save={save}
        />
        <DeleteAllData canDeleteAll={canDeleteAll} onConfirm={() => void removeAll()} />
        <div role="status">
          {failed > 0 && (
            <p key={failed} className="small">
              {t("past.deleteAll.failed")}
            </p>
          )}
        </div>
      </section>
      <Button onPress={onBack}>{t("settingsScreen.back")}</Button>
    </Page>
  );
}
