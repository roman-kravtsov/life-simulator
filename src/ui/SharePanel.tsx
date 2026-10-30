// Keeping a finished life outside the game (SHARE-001, SHARE-002): copy a few lines about it, or save the rings as a
// picture. Made in the browser and handed to the player, who decides where they go. If the browser will not copy,
// the text is shown to select. Each result is said once in a status region.
import { useId, useMemo, useRef, useState } from "react";
import type { LifeSummary } from "../engine/summary";
import { t } from "../i18n";
import { downloadBlob } from "../save/file";
import { copyText, svgToPng } from "../save/share";
import { Button } from "./kit";
import { useNotice } from "./LifeFiles";
import { shareFileName, shareText } from "./share";
import { CARD_HEIGHT, CARD_WIDTH, shareCardSvg } from "./shareCard";
import styles from "./SharePanel.module.css";

export interface SharePanelProps {
  summary: LifeSummary;
  /** The browser's clipboard, unless a test gives its own. */
  copy?: (text: string) => Promise<boolean>;
  /** A PNG of an SVG document, unless a test gives its own. */
  makeImage?: (svg: string, width: number, height: number) => Promise<Blob | null>;
  /** Hands a file to the player; the browser's download unless a test gives its own. */
  save?: (fileName: string, blob: Blob) => boolean;
}

export function SharePanel({ summary, copy = copyText, makeImage = svgToPng, save = downloadBlob }: SharePanelProps) {
  const headingId = useId();
  const { region, say } = useNotice(false);
  const text = useMemo(() => shareText(summary), [summary]);
  const [shown, setShown] = useState(false);
  // A second press while the picture is being made would make a second one; the button stays, so focus is not lost.
  const making = useRef(false);
  const words = useRef<HTMLPreElement>(null);

  async function copyIt() {
    if (await copy(text)) say(t("share.copied", { name: summary.name }));
    else {
      setShown(true);
      say(t("share.copyFailed"));
    }
  }

  async function saveImage() {
    if (making.current) return;
    making.current = true;
    const fileName = shareFileName(summary.seed);
    try {
      const picture = await makeImage(shareCardSvg(summary), CARD_WIDTH, CARD_HEIGHT);
      say(picture && save(fileName, picture) ? t("share.imageSaved", { fileName }) : t("share.imageFailed"));
    } catch {
      say(t("share.imageFailed"));
    } finally {
      making.current = false;
    }
  }

  /** For whoever cannot drag across the text: the keyboard then copies what is selected. */
  function selectIt() {
    if (!words.current) return;
    window.getSelection()?.selectAllChildren(words.current);
    say(t("share.selected"));
  }

  return (
    <section aria-labelledby={headingId} className={styles.share}>
      <h2 id={headingId} className={`eyebrow ${styles.heading}`}>
        {t("share.heading")}
      </h2>
      <p className="small">{t("share.about")}</p>
      <div className={styles.buttons}>
        <Button onPress={() => void copyIt()}>{t("share.copy")}</Button>
        <Button onPress={() => void saveImage()}>{t("share.image")}</Button>
      </div>
      {region}
      <details className={`disclosure ${styles.text}`} open={shown} onToggle={(e) => setShown(e.currentTarget.open)}>
        <summary>{t("share.textLabel")}</summary>
        <pre ref={words}>{text}</pre>
        <Button onPress={selectIt}>{t("share.select")}</Button>
      </details>
    </section>
  );
}
