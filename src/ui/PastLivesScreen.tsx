// The archive of finished lives (SAVE-003, SAVE-007, UI-008): each life as a card with its growth rings in small, its
// name, where and how long it was lived, its epitaph and when it ended. Each can be opened or deleted after a
// confirmation, and everything the game keeps in the browser can be deleted at once. Wide windows set the cards two
// across; phones one under another.
import { useState } from "react";
import type { PastLifeListing } from "../save";
import { countryName, formatDay } from "../format";
import { t } from "../i18n";
import { DeleteAllData } from "./DeleteAllData";
import { Button, ConfirmDialog } from "./kit";
import { ExportPastLife, ImportLife, type SaveText } from "./LifeFiles";
import { Page } from "./Page";
import styles from "./PastLivesScreen.module.css";
import { RingsThumb } from "./RingsThumb";
import { SiteHeader } from "./SiteHeader";
import type { GameStore } from "./store";
import { useFocusOn } from "./useFocusOn";
import { causeWords } from "./words";

interface Props {
  /** Null while they are being loaded. */
  lives: PastLifeListing[] | null;
  /** The archive could not be read or written (the last write or read failed). */
  problem: boolean;
  /** Whether there is anything stored to delete: a past life or the life in progress. */
  canDeleteAll: boolean;
  onOpen: (id: string) => void;
  /** Resolves true only when the life was deleted. */
  onDelete: GameStore["deletePastLife"];
  /** Resolves true only when everything was deleted. */
  onDeleteAll: GameStore["deleteAllData"];
  /** Lives as files (SAVE-006). */
  onExport: GameStore["exportPastLife"];
  onImport: GameStore["importLife"];
  onBack: () => void;
  /** Injected in tests; the browser's download otherwise. */
  save?: SaveText;
}

interface LifeProps {
  life: PastLifeListing;
  onOpen: () => void;
  onDelete: () => void;
  onExport: GameStore["exportPastLife"];
  onNotice: (text: string) => void;
  save?: SaveText;
}

function Life({ life, onOpen, onDelete, onExport, onNotice, save }: LifeProps) {
  return (
    <li className={styles.life}>
      <div className={styles.top}>
        <RingsThumb rings={life.rings} className={styles.rings} />
        <div className={styles.about}>
          <h2 className={styles.name}>{life.name}</h2>
          <p>
            {t("past.line", {
              born: life.birthYear,
              country: countryName(life.country),
              age: life.age,
              cause: causeWords(life.cause),
            })}
          </p>
        </div>
      </div>
      {life.epitaph && <p className={styles.epitaph}>{life.epitaph}</p>}
      <p className="small">{t("past.finished", { date: formatDay(life.finishedAt) })}</p>
      <div className={styles.actions}>
        <Button aria-label={t("past.openLabel", { name: life.name })} onPress={onOpen}>
          {t("past.open")}
        </Button>
        <ConfirmDialog
          trigger={<Button aria-label={t("past.deleteLabel", { name: life.name })}>{t("past.delete")}</Button>}
          title={t("past.deleteConfirm.title", { name: life.name })}
          confirmLabel={t("past.deleteConfirm.yes")}
          cancelLabel={t("past.deleteConfirm.no")}
          onConfirm={onDelete}
        >
          <p>{t("past.deleteConfirm.body")}</p>
        </ConfirmDialog>
        <ExportPastLife life={life} onExport={onExport} onNotice={onNotice} save={save} />
      </div>
    </li>
  );
}

export function PastLivesScreen({
  lives,
  problem,
  canDeleteAll,
  onOpen,
  onDelete,
  onDeleteAll,
  onExport,
  onImport,
  onBack,
  save,
}: Props) {
  // Focus returns to the heading when the list arrives and when a life is deleted, whose button is gone.
  const heading = useFocusOn<HTMLHeadingElement>(lives?.length ?? -1);
  // The one status region, always on the page, says what was deleted (or that it could not be) once the life's own
  // button is gone. Each notice is a new node, so the same words twice are announced twice; it goes when the player
  // moves on.
  const [notice, setNotice] = useState<{ text: string; n: number } | null>(null);
  const say = (text: string) => setNotice((was) => ({ text, n: (was?.n ?? 0) + 1 }));
  const clear = () => setNotice((was) => (was === null ? was : null));
  // The buttons that cause a notice can be far below it: it is brought into view (where scrolling is possible at all).
  const showNotice = (element: HTMLParagraphElement | null) => element?.scrollIntoView?.({ block: "nearest" });
  async function remove(life: PastLifeListing) {
    clear();
    say(t((await onDelete(life.id)) ? "past.deleted" : "past.deleteFailed", { name: life.name }));
  }
  async function removeAll() {
    clear();
    if (!(await onDeleteAll())) say(t("past.deleteAll.failed"));
  }
  return (
    <Page header={<SiteHeader />}>
      {/* Any key or press in the screen lets the last notice go. */}
      <div onKeyDownCapture={clear} onClickCapture={clear} className={styles.screen}>
        <h1 ref={heading} tabIndex={-1}>
          {t("past.title")}
        </h1>
        <p className="lead">{t("past.intro")}</p>
        <div role="status">
          {problem && (
            <p className="note" role="note">
              {t("past.problem")}
            </p>
          )}
          {lives === null && <p className="small">{t("past.loading")}</p>}
          {notice && (
            <p key={notice.n} className="small" ref={showNotice}>
              {notice.text}
            </p>
          )}
        </div>
        {lives !== null && lives.length === 0 && <p>{t("past.empty")}</p>}
        {lives !== null && lives.length > 0 && (
          <ul role="list" className={styles.list}>
            {lives.map((life) => (
              <Life
                key={life.id}
                life={life}
                onOpen={() => onOpen(life.id)}
                onDelete={() => void remove(life)}
                onExport={onExport}
                onNotice={say}
                save={save}
              />
            ))}
          </ul>
        )}
        <div className={styles.load}>
          <p className="small">{t("files.about")}</p>
          <ImportLife onImport={onImport} onNotice={say} />
        </div>
        <DeleteAllData canDeleteAll={canDeleteAll} onConfirm={() => void removeAll()} />
        <Button onPress={onBack}>{t("life.backToStart")}</Button>
      </div>
    </Page>
  );
}
