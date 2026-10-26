// "Delete all local data" (SAVE-007), on the past lives and the settings screens: what it does, or that nothing is
// stored, and the button, which asks first. The screen that holds it says what happened in its own status region.
import { t } from "../i18n";
import styles from "./DeleteAllData.module.css";
import { Button, ConfirmDialog } from "./kit";

interface Props {
  /** Whether anything may be stored to delete; the button is disabled otherwise. */
  canDeleteAll: boolean;
  onConfirm: () => void;
}

export function DeleteAllData({ canDeleteAll, onConfirm }: Props) {
  return (
    <div className={styles.all}>
      <p className="small">{t(canDeleteAll ? "past.deleteAll.about" : "past.deleteAll.nothing")}</p>
      <ConfirmDialog
        trigger={<Button isDisabled={!canDeleteAll}>{t("past.deleteAll")}</Button>}
        title={t("past.deleteAll.title")}
        confirmLabel={t("past.deleteAll.yes")}
        cancelLabel={t("past.deleteAll.no")}
        onConfirm={onConfirm}
      >
        <p>{t("past.deleteAll.body")}</p>
      </ConfirmDialog>
    </div>
  );
}
