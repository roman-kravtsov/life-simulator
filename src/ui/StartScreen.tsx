// The title page (UI-002): growth rings as an emblem, the title, a few lines on what the game is, the content note and
// the two settings that shape a life, then Begin a life, one press after the note. A life saved in this browser is
// offered first (SAVE-002). Past lives, the settings and the sources are quiet buttons at the foot.
import { useDeferredValue, useId, useState } from "react";
import type { Settings } from "../engine/types";
import { countryName } from "../format";
import { t } from "../i18n";
import { Button } from "./kit";
import { Page } from "./Page";
import { SettingsPanel } from "./SettingsPanel";
import { SiteHeader } from "./SiteHeader";
import styles from "./StartScreen.module.css";
import type { LoadStatus, ResumeOffer } from "./store";
import { useFocusOn } from "./useFocusOn";

export interface StartScreenProps {
  status: LoadStatus;
  settings: Settings;
  /** A life saved in this browser, or why it cannot be opened (SAVE-002). */
  resume: ResumeOffer | null;
  /** Everything stored in this browser was just deleted (SAVE-007). */
  deleted: boolean;
  onSettings: (changes: Partial<Settings>) => void;
  onBegin: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onPast: () => void;
  /** The settings screen (UI-009). */
  onOpenSettings: () => void;
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

/** Radii of the rings, from the bark inward: mostly plain years, a few coloured ones, wider early, as in a cut log. */
const EMBLEM_RINGS = [
  { r: 46, theme: "plain" },
  { r: 42, theme: "work" },
  { r: 38.5, theme: "plain" },
  { r: 34.5, theme: "move" },
  { r: 30, theme: "plain" },
  { r: 25, theme: "study" },
  { r: 19.5, theme: "plain" },
  { r: 13.5, theme: "love" },
  { r: 7.5, theme: "plain" },
] as const;

/**
 * Growth rings, still: decoration beside the title, so a screen reader skips it. Drawn with the ring colours, which
 * have a light and a dark value, with a line of paper between rings as in the rings of a life.
 */
const emblem = (
  <svg viewBox="0 0 100 100" className={styles.emblem} aria-hidden="true" focusable="false">
    {EMBLEM_RINGS.map(({ r, theme }) => (
      <circle key={r} cx="50" cy="50" r={r} className={`${styles.ring} ${styles[`fill-${theme}`]}`} />
    ))}
    <circle cx="50" cy="50" r="2.5" className={styles.pith} />
  </svg>
);

export function StartScreen({
  status,
  settings,
  resume,
  deleted,
  onSettings,
  onBegin,
  onResume,
  onDiscard,
  onPast,
  onOpenSettings,
  onSources,
}: StartScreenProps) {
  // Back from a failed load (the birth reveal plays before the country is in), the screen opens on the error, which is
  // where focus goes: it is read out, and the title is not what the player was waiting for. Otherwise the title, as
  // ever. A failure that comes while the player is already here leaves focus where it is, on Begin.
  const [openedOnError] = useState(status === "error");
  const heading = useFocusOn<HTMLHeadingElement>(undefined, !openedOnError);
  const problem = useFocusOn<HTMLParagraphElement>(undefined, openedOnError);
  const resumeHeading = useId();
  const loading = status === "loading";
  // The words arrive after the status region is on the page (the first render has none), so they are announced.
  const done = useDeferredValue(deleted ? t("start.deleted") : "", "");
  return (
    <Page header={<SiteHeader />}>
      <div className={styles.title}>
        {emblem}
        <h1 ref={heading} tabIndex={-1} className={styles.heading}>
          {t("app.title")}
          <span className="subtitle">{t("app.subtitle")}</span>
        </h1>
      </div>
      {resume?.kind === "offer" && (
        <section aria-labelledby={resumeHeading} className={styles.resume}>
          <h2 id={resumeHeading} className={`eyebrow ${styles.resumeHeading}`}>
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
      <div className={styles.begin}>
        {/* Stays focusable while loading (aria-disabled, guarded handler) so focus is not dropped to the body. */}
        <Button
          variant={resume?.kind === "offer" ? "ghost" : "primary"}
          onPress={loading ? undefined : onBegin}
          aria-disabled={loading || undefined}
        >
          {t("start.begin")}
        </Button>
        <div role="status">
          {loading && <p className="small">{t("start.loading")}</p>}
          {done && <p className="small">{done}</p>}
        </div>
        {status === "error" && (
          <p role="alert" ref={problem} tabIndex={-1}>
            {t("start.error")}
          </p>
        )}
      </div>
      <nav aria-label={t("start.more")} className={styles.links}>
        <Button onPress={onPast}>{t("start.past")}</Button>
        <Button onPress={onOpenSettings}>{t("start.settings")}</Button>
        <Button onPress={onSources}>{t("start.sources")}</Button>
      </nav>
      <p className={`small ${styles.privacy}`}>{t("start.privacy")}</p>
    </Page>
  );
}
