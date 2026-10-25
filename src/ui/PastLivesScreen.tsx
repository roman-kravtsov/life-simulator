// The archive of finished lives (SAVE-003, SAVE-007, UI-008): kept plain here; thumbnails come with UI-008. Each
// life can be opened or deleted after a confirmation, and everything the game keeps in the browser can be
// deleted at once.
import { useState } from "react";
import type { PastLifeListing } from "../save";
import { countryName, formatDay } from "../format";
import { t } from "../i18n";
import { Header } from "./Header";
import { Button, ConfirmDialog } from "./kit";
import styles from "./PastLivesScreen.module.css";
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
  onBack: () => void;
}

function Life({ life, onOpen, onDelete }: { life: PastLifeListing; onOpen: () => void; onDelete: () => void }) {
  return (
    <li className={styles.life}>
      <h2 className={styles.name}>{life.name}</h2>
      <p>
        {t("past.line", {
          born: life.birthYear,
          country: countryName(life.country),
          age: life.age,
          cause: causeWords(life.cause),
        })}
      </p>
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
      </div>
    </li>
  );
}

export function PastLivesScreen({ lives, problem, canDeleteAll, onOpen, onDelete, onDeleteAll, onBack }: Props) {
  // Focus returns to the heading when the list arrives and when a life is deleted, whose button is gone.
  const heading = useFocusOn<HTMLHeadingElement>(lives?.length ?? -1);
  // The one status region, always on the page, says what was deleted (or that it could not be) once the life's own
  // button is gone. Each notice is a new node, so the same words twice are announced twice; it goes when the player
  // moves on.
  const [notice, setNotice] = useState<{ text: string; n: number } | null>(null);
  const say = (text: string) => setNotice((was) => ({ text, n: (was?.n ?? 0) + 1 }));
  const clear = () => setNotice((was) => (was === null ? was : null));
  async function remove(life: PastLifeListing) {
    clear();
    say(t((await onDelete(life.id)) ? "past.deleted" : "past.deleteFailed", { name: life.name }));
  }
  async function removeAll() {
    clear();
    if (!(await onDeleteAll())) say(t("past.deleteAll.failed"));
  }
  return (
    <section onKeyDownCapture={clear} onClickCapture={clear}>
      <Header />
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
          <p key={notice.n} className="small">
            {notice.text}
          </p>
        )}
      </div>
      {lives !== null && lives.length === 0 && <p>{t("past.empty")}</p>}
      {lives !== null && lives.length > 0 && (
        <ul role="list" className={styles.list}>
          {lives.map((life) => (
            <Life key={life.id} life={life} onOpen={() => onOpen(life.id)} onDelete={() => void remove(life)} />
          ))}
        </ul>
      )}
      <div className={styles.all}>
        <p className="small">{t(canDeleteAll ? "past.deleteAll.about" : "past.deleteAll.nothing")}</p>
        <ConfirmDialog
          trigger={<Button isDisabled={!canDeleteAll}>{t("past.deleteAll")}</Button>}
          title={t("past.deleteAll.title")}
          confirmLabel={t("past.deleteAll.yes")}
          cancelLabel={t("past.deleteAll.no")}
          onConfirm={() => void removeAll()}
        >
          <p>{t("past.deleteAll.body")}</p>
        </ConfirmDialog>
      </div>
      <Button onPress={onBack}>{t("life.backToStart")}</Button>
    </section>
  );
}
