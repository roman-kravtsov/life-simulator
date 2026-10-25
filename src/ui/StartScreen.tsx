import { useId } from "react";
import type { Settings } from "../engine/types";
import { countryName } from "../format";
import { t } from "../i18n";
import { Header } from "./Header";
import { Button } from "./kit";
import { SettingsPanel } from "./SettingsPanel";
import styles from "./StartScreen.module.css";
import type { LoadStatus, ResumeOffer } from "./store";
import { useFocusOn } from "./useFocusOn";

interface Props {
  status: LoadStatus;
  settings: Settings;
  /** A life saved in this browser, or why it cannot be opened (SAVE-002). */
  resume: ResumeOffer | null;
  onSettings: (changes: Partial<Settings>) => void;
  onBegin: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onPast: () => void;
  onSources: () => void;
}

/** "Amara, 34, in Kenya", or less when the save does not say. */
function resumeLine(offer: Extract<ResumeOffer, { kind: "offer" }>): string {
  const { name, age, country } = offer;
  if (name === undefined || age === undefined) return t("start.resume.unknown");
  return country
    ? t("start.resume.line", { name, age, country: countryName(country) })
    : t("start.resume.lineNoPlace", { name, age });
}

export function StartScreen({
  status,
  settings,
  resume,
  onSettings,
  onBegin,
  onResume,
  onDiscard,
  onPast,
  onSources,
}: Props) {
  const heading = useFocusOn<HTMLHeadingElement>();
  const resumeHeading = useId();
  const loading = status === "loading";
  return (
    <section>
      <Header />
      <h1 ref={heading} tabIndex={-1}>
        {t("app.title")}
        <span className="subtitle">{t("app.subtitle")}</span>
      </h1>
      {resume?.kind === "offer" && (
        <section aria-labelledby={resumeHeading} className={styles.resume}>
          <h2 id={resumeHeading} className={`eyebrow ${styles.heading}`}>
            {t("start.resume.heading")}
          </h2>
          <p className={styles.line}>{resumeLine(resume)}</p>
          <Button variant="primary" onPress={loading ? undefined : onResume} aria-disabled={loading || undefined}>
            {t("start.resume.continue")}
          </Button>
          <p className={`small ${styles.about}`}>{t("start.resume.note")}</p>
        </section>
      )}
      {resume?.kind === "problem" && (
        <div className={styles.problem}>
          <p className="note" role="note">
            {t(`start.problem.${resume.reason}`)}
          </p>
          <Button onPress={onDiscard}>{t("start.problem.discard")}</Button>
        </div>
      )}
      <p className="lead">{t("start.intro")}</p>
      <p className="note" role="note">
        {t("start.contentNote")}
      </p>
      <SettingsPanel settings={settings} onChange={onSettings} />
      {/* Stays focusable while loading (aria-disabled, guarded handler) so focus is not dropped to the body. */}
      <Button
        variant={resume?.kind === "offer" ? "ghost" : "primary"}
        onPress={loading ? undefined : onBegin}
        aria-disabled={loading || undefined}
      >
        {t("start.begin")}
      </Button>
      <div role="status">{loading && <p className="small">{t("start.loading")}</p>}</div>
      {status === "error" && <p role="alert">{t("start.error")}</p>}
      <p className="small">{t("start.privacy")}</p>
      <div className={styles.links}>
        <Button onPress={onPast}>{t("start.past")}</Button>
        <Button onPress={onSources}>{t("start.sources")}</Button>
      </div>
      <p className="small">{t("start.preview")}</p>
    </section>
  );
}
