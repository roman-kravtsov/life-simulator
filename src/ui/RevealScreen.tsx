// The birth reveal (UI-016): between Begin and the birth screen, a quiet line of countries passes in the serif face,
// slows, and stops on the real one, which is already drawn (store.begin). The sequence is CSS alone: every name is
// stacked in one cell with an animation delayed by the sum of the gaps before it, and the last, invisible, animation
// ends the reveal. No timers (TIME-001). Under reduced motion, and once the reel is over while the country is still
// loading, there is no reel: the real name stands still, with a way back to the start.
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { countryName, formatNumber } from "../format";
import { t } from "../i18n";
import { displayStore, reducesMotion, subscribeSystemMotion, systemReducesMotion, type DisplayStore } from "./display";
import { Button } from "./kit";
import { Page } from "./Page";
import styles from "./RevealScreen.module.css";
import { revealTimings, type RevealView } from "./reveal";
import { SiteHeader } from "./SiteHeader";
import { useFocusOn } from "./useFocusOn";

interface Props {
  view: RevealView;
  /** The reveal is over: the hold ended, Skip or Escape was pressed, or (`reduced`) there was no reel to play. */
  onEnd: (options?: { reduced?: boolean }) => void;
  /** Back to the start, from the still state while the country loads (which is also the way out of a load that hangs). */
  onBack: () => void;
  /** Injected in tests; the page's own preferences otherwise. */
  display?: DisplayStore;
}

/** The timings the style sheet cannot know, as the custom properties it reads. */
const vars = (values: Record<string, string>) => values as CSSProperties;

export function RevealScreen({ view, onEnd, onBack, display = displayStore }: Props) {
  const preference = useSyncExternalStore(display.subscribe, display.getSnapshot);
  const systemReduces = useSyncExternalStore(subscribeSystemMotion, systemReducesMotion);
  const reduced = reducesMotion(preference, systemReduces);
  const [settled, setSettled] = useState(false);
  // The hold ended while the player's focus was elsewhere (the help link in the header): wait for them to continue.
  const [waiting, setWaiting] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const statusId = useId();
  const { gaps, delays, settleAt } = useMemo(() => revealTimings(view.stops.length), [view.stops.length]);
  const still = reduced || view.opening;
  const place = countryName(view.country);

  // No reel to play: hand over at once. The birth screen then says how the country was drawn.
  useEffect(() => {
    if (reduced) onEnd({ reduced: true });
  }, [reduced, onEnd]);

  useEffect(() => {
    if (still) return;
    const skip = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEnd();
    };
    document.addEventListener("keydown", skip);
    return () => document.removeEventListener("keydown", skip);
  }, [still, onEnd]);

  /** The hold is over. Ends the reveal, unless that would move focus away from where the player went. */
  const held = () => {
    const active = document.activeElement;
    const here = !active || active === document.body || active.id === "content" || screenRef.current?.contains(active);
    if (here) onEnd();
    else setWaiting(true);
  };

  // The one live message: where the search is, then where it ended, with how likely that was. The names that pass are
  // never in it. The sentence about the odds is in the live message only: its visible copy is hidden from readers.
  const share = t("reveal.share", { share: formatNumber(view.share), count: formatNumber(view.countries) });
  const caption = still ? t("reveal.opening") : settled ? t("reveal.result", { country: place }) : t("reveal.finding");
  const status = (
    <p role="status" id={statusId} className={styles.status}>
      {caption}
      {settled && <span className="visually-hidden">. {share}</span>}
    </p>
  );

  // A different component from the reel's, so that the Skip button is gone, and not turned into Back under the finger
  // that pressed it.
  if (still) return <Still place={place} caption={caption} statusId={statusId} onBack={onBack} />;

  return (
    <Page header={<SiteHeader />}>
      <div ref={screenRef} className={styles.screen} style={vars({ "--settle": `${settleAt}ms` })}>
        <div className={styles.skip}>
          <Button autoFocus aria-describedby={statusId} onPress={() => onEnd()}>
            {waiting ? t("reveal.continue") : t("reveal.skip")}
          </Button>
        </div>
        <div className={styles.stage}>
          <h1 className="visually-hidden">{t("reveal.title")}</h1>
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
            <span className={styles.real} data-settle onAnimationEnd={() => setSettled(true)}>
              {place}
            </span>
          </div>
          <span className={styles.rule} data-rule aria-hidden="true" />
          <p className={styles.share} aria-hidden="true">
            {share}
          </p>
          {/* Invisible: it holds the finished picture for a moment, and its end is the end of the reveal. */}
          <span className={styles.hold} data-hold aria-hidden="true" onAnimationEnd={held} />
        </div>
      </div>
    </Page>
  );
}

interface StillProps {
  place: string;
  caption: string;
  statusId: string;
  onBack: () => void;
}

/**
 * No reel (reduced motion, or the reel is over while the country loads): the real name, still. Focus goes to the status,
 * which is read out; Back to start is one Tab away, so a second press of the key that skipped does not abandon the life.
 */
function Still({ place, caption, statusId, onBack }: StillProps) {
  const status = useFocusOn<HTMLParagraphElement>();
  return (
    <Page header={<SiteHeader />}>
      <div className={styles.screen}>
        <div className={styles.stage}>
          <h1 className="visually-hidden">{t("reveal.title")}</h1>
          <p role="status" id={statusId} ref={status} tabIndex={-1} className={styles.status}>
            {caption}
          </p>
          <div className={styles.reel}>
            <span className={styles.name}>{place}</span>
          </div>
          <Button aria-describedby={statusId} onPress={onBack}>
            {t("life.backToStart")}
          </Button>
        </div>
      </div>
    </Page>
  );
}
