// Bringing the first-life hints back (UI-015), on the settings screen. They belong to the reader, not to a life, so they
// live in hints.ts beside the display preferences.
import { useId, useState } from "react";
import { t } from "../i18n";
import { hintStore, type HintStore } from "./hints";
import styles from "./HintSettings.module.css";
import { Button } from "./kit";

interface Props {
  /** Injected in tests; the page's own otherwise. */
  store?: HintStore;
}

export function HintSettings({ store = hintStore }: Props) {
  const headingId = useId();
  const aboutId = useId();
  // The button stays available and keeps focus; what it did is said in the status region, a new node for every press.
  const [presses, setPresses] = useState(0);
  return (
    <section aria-labelledby={headingId} className={styles.hints}>
      <h2 id={headingId} className={`eyebrow ${styles.heading}`}>
        {t("hints.heading")}
      </h2>
      <p id={aboutId} className="small">
        {t("hints.about")}
      </p>
      <div>
        <Button
          aria-describedby={aboutId}
          onPress={() => {
            store.reset();
            setPresses((count) => count + 1);
          }}
        >
          {t("hints.again")}
        </Button>
        <div role="status" className={styles.done}>
          {presses > 0 && (
            <p key={presses} className="small">
              {t("hints.again.done")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
