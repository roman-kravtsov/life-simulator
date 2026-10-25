// The archive of finished lives (SAVE-003, SAVE-007, UI-008): kept plain here; thumbnails come with UI-008. Each
// life can be opened or deleted after a confirmation, and everything the game keeps in the browser can be
// deleted at once.
import type { PastLifeListing } from "../save";
import { countryName, formatDay } from "../format";
import { hasString, t } from "../i18n";
import { Header } from "./Header";
import { Button, ConfirmDialog } from "./kit";
import styles from "./PastLivesScreen.module.css";
import { useFocusOn } from "./useFocusOn";

interface Props {
  /** Null while they are being loaded. */
  lives: PastLifeListing[] | null;
  /** The archive could not be read or written (the last write or read failed). */
  problem: boolean;
  /** Whether there is anything stored to delete: a past life or the life in progress. */
  canDeleteAll: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onBack: () => void;
}

function Life({ life, onOpen, onDelete }: { life: PastLifeListing; onOpen: () => void; onDelete: () => void }) {
  const cause = t(hasString(`cause.${life.cause}`) ? `cause.${life.cause}` : "cause.other");
  return (
    <li className={styles.life}>
      <h2 className={styles.name}>{life.name}</h2>
      <p>
        {t("past.line", {
          born: life.birthYear,
          country: countryName(life.country),
          age: life.age,
          cause,
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
  return (
    <section>
      <Header />
      <h1 ref={heading} tabIndex={-1}>
        {t("past.title")}
      </h1>
      <p className="lead">{t("past.intro")}</p>
      {problem && (
        <p className="note" role="note">
          {t("past.problem")}
        </p>
      )}
      <div role="status">{lives === null && <p className="small">{t("past.loading")}</p>}</div>
      {lives !== null && lives.length === 0 && <p>{t("past.empty")}</p>}
      {lives !== null && lives.length > 0 && (
        <ul className={styles.list}>
          {lives.map((life) => (
            <Life key={life.id} life={life} onOpen={() => onOpen(life.id)} onDelete={() => onDelete(life.id)} />
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
          onConfirm={onDeleteAll}
        >
          <p>{t("past.deleteAll.body")}</p>
        </ConfirmDialog>
      </div>
      <Button onPress={onBack}>{t("life.backToStart")}</Button>
    </section>
  );
}
