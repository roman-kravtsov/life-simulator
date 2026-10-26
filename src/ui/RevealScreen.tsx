// The birth reveal (UI-016): between Begin and the birth screen, a quiet line of countries passes in the serif face,
// slows, and stops on the real one, which is already drawn (store.begin). The sequence is CSS alone: every name is
// stacked in one cell with an animation delayed by the sum of the gaps before it, and the last, invisible, animation
// ends the reveal. No timers (TIME-001). Under reduced motion there is no reel at all.
import { useEffect, useMemo, useState, useSyncExternalStore, type AnimationEvent, type CSSProperties } from "react";
import { countryName, formatNumber } from "../format";
import { t } from "../i18n";
import { displayStore, reducesMotion, subscribeSystemMotion, systemReducesMotion, type DisplayStore } from "./display";
import { Button } from "./kit";
import { Page } from "./Page";
import styles from "./RevealScreen.module.css";
import { revealTimings, type RevealView } from "./reveal";
import { SiteHeader } from "./SiteHeader";

interface Props {
  view: RevealView;
  /** The reveal is over: the hold ended, Skip or Escape was pressed, or (`reduced`) there was no reel to play. */
  onEnd: (options?: { reduced?: boolean }) => void;
  /** Injected in tests; the page's own preferences otherwise. */
  display?: DisplayStore;
}

/** The timings the style sheet cannot know, as the custom properties it reads. */
const vars = (values: Record<string, string>) => values as CSSProperties;

/** An animation of the element itself ended, not one that bubbled up from inside it. */
const own = (event: AnimationEvent) => event.target === event.currentTarget;

export function RevealScreen({ view, onEnd, display = displayStore }: Props) {
  const preference = useSyncExternalStore(display.subscribe, display.getSnapshot);
  const systemReduces = useSyncExternalStore(subscribeSystemMotion, systemReducesMotion);
  const reduced = reducesMotion(preference, systemReduces);
  const [settled, setSettled] = useState(false);
  const { gaps, delays, settleAt } = useMemo(() => revealTimings(view.stops.length), [view.stops.length]);

  // No reel to play: hand over at once. The birth screen then says how the country was drawn.
  useEffect(() => {
    if (reduced) onEnd({ reduced: true });
  }, [reduced, onEnd]);

  useEffect(() => {
    if (reduced) return;
    const skip = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEnd();
    };
    document.addEventListener("keydown", skip);
    return () => document.removeEventListener("keydown", skip);
  }, [reduced, onEnd]);

  // The one live message: where the search is, then where it ended. The names that pass are never in it.
  const message =
    reduced || view.opening
      ? t("reveal.opening")
      : settled
        ? t("reveal.result", { country: countryName(view.country) })
        : t("reveal.finding");
  const status = (
    <p role="status" aria-live="polite" className={styles.status}>
      {message}
    </p>
  );

  if (reduced) {
    return (
      <Page header={<SiteHeader />}>
        <div className={styles.screen}>{status}</div>
      </Page>
    );
  }

  return (
    <Page header={<SiteHeader />}>
      <div className={styles.screen} style={vars({ "--settle": `${settleAt}ms` })}>
        <div className={styles.skip}>
          <Button autoFocus onPress={() => onEnd()}>
            {t("reveal.skip")}
          </Button>
        </div>
        <div className={styles.stage}>
          {status}
          <div className={styles.reel} data-reel aria-hidden="true">
            {view.stops.map((stop, i) => (
              <span
                key={stop.iso2}
                className={styles.stop}
                style={vars({ "--delay": `${delays[i]}ms`, "--gap": `${gaps[i]}ms` })}
              >
                {countryName(stop)}
              </span>
            ))}
            <span
              className={styles.real}
              data-settle
              onAnimationEnd={(event) => {
                if (own(event)) setSettled(true);
              }}
            >
              {countryName(view.country)}
            </span>
          </div>
          <span className={styles.rule} data-rule aria-hidden="true" />
          <p className={styles.share}>
            {t("reveal.share", { share: formatNumber(view.share), count: formatNumber(view.countries) })}
          </p>
          {/* Invisible: it holds the finished picture for a moment, and its end is the end of the reveal. */}
          <span
            className={styles.hold}
            data-hold
            aria-hidden="true"
            onAnimationEnd={(event) => {
              if (own(event)) onEnd();
            }}
          />
        </div>
      </div>
    </Page>
  );
}
