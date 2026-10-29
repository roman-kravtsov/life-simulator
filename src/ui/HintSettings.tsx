// Bringing the first-life hints back (UI-015), on the settings screen. They belong to the reader, not to a life, so they
// live in hints.ts beside the display preferences.
import { useId, useSyncExternalStore } from "react";
import { t } from "../i18n";
import { hintStore, type HintStore } from "./hints";
import styles from "./HintSettings.module.css";
import { Button } from "./kit";

interface Props {
  /** Injected in tests; the page's own otherwise. */
  store?: HintStore;
}

export function HintSettings({ store = hintStore }: Props) {
  const seen = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const headingId = useId();
  const aboutId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.hints}>
      <h2 id={headingId} className={`eyebrow ${styles.heading}`}>
        {t("hints.heading")}
      </h2>
      <p id={aboutId} className="small">
        {t("hints.about")}
      </p>
      <div>
        <Button isDisabled={seen.length === 0} aria-describedby={aboutId} onPress={store.reset}>
          {t("hints.again")}
        </Button>
        {seen.length === 0 && <p className={`small ${styles.none}`}>{t("hints.none")}</p>}
      </div>
    </section>
  );
}
