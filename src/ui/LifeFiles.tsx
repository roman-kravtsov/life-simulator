// Lives as files (SAVE-006): saving the life in progress or a finished one to a .json file, and loading one back,
// from the settings and the past lives screens. The store does the work; these are the buttons and what they say.
import { useState, type ReactNode } from "react";
import { t } from "../i18n";
import { downloadText, readText } from "../save/file";
import { Button, ConfirmDialog, FileButton } from "./kit";
import styles from "./LifeFiles.module.css";
import { IMPORT_MAX_LENGTH, type GameStore, type ImportOutcome } from "./store";

/** Hands a file to the player; the browser's download unless a test gives its own. */
export type SaveText = (fileName: string, text: string) => boolean;

/** One notice at a time, each a new node so the same words twice are announced twice; `region` is the status region. */
export function useNotice(): { region: ReactNode; say: (text: string) => void } {
  const [notice, setNotice] = useState<{ text: string; n: number } | null>(null);
  return {
    say: (text) => setNotice((was) => ({ text, n: (was?.n ?? 0) + 1 })),
    region: (
      <div role="status">
        {notice && (
          <p key={notice.n} className="small">
            {notice.text}
          </p>
        )}
      </div>
    ),
  };
}

/** What a finished import says: what was loaded and where it is, or why it could not be (never "in progress": that asks). */
function outcomeWords(outcome: ImportOutcome): string {
  if (!outcome.ok) return t(`files.fail.${outcome.reason}`);
  const { name, age } = outcome;
  const said =
    outcome.kind === "current"
      ? t("files.loaded.current", { name, age })
      : t(outcome.added ? "files.loaded.past" : "files.loaded.pastKept", { name, age });
  return outcome.inexact ? `${said} ${t("files.inexact")}` : said;
}

interface ImportProps {
  onImport: GameStore["importLife"];
  /** Where the outcome is said: the screen's own status region. */
  onNotice: (text: string) => void;
}

/** "Load a life from a file", and the question when it would replace the life in progress. */
export function ImportLife({ onImport, onNotice }: ImportProps) {
  // The text of a file that is waiting on the answer to "Replace the life in progress?", and whose life it is.
  const [pending, setPending] = useState<{
    text: string;
    name: string;
    replaces?: { name: string; age: number };
  } | null>(null);

  async function run(text: string, replace: boolean) {
    const outcome = await onImport(text, replace ? { replace: true } : undefined);
    if (!outcome.ok && outcome.reason === "inProgress") {
      setPending({ text, name: outcome.name ?? "", ...(outcome.replaces ? { replaces: outcome.replaces } : {}) });
    } else onNotice(outcomeWords(outcome));
  }

  async function chosen(file: File | null) {
    if (!file) return;
    // A character takes at most four bytes, so a bigger file is too big without reading it.
    if (file.size > IMPORT_MAX_LENGTH * 4) return onNotice(t("files.fail.tooBig"));
    const text = await readText(file);
    if (text === null) onNotice(t("files.fail.unreadable"));
    else await run(text, false);
  }

  return (
    <>
      <FileButton onSelect={(file) => void chosen(file)}>{t("files.load")}</FileButton>
      <ConfirmDialog
        isOpen={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={t("files.replace.title")}
        confirmLabel={t("files.replace.yes")}
        cancelLabel={t("files.replace.no")}
        onConfirm={() => pending && void run(pending.text, true)}
      >
        <p>
          {pending?.replaces
            ? t("files.replace.bodyOf", {
                name: pending.name,
                current: pending.replaces.name,
                age: pending.replaces.age,
              })
            : t("files.replace.body", { name: pending?.name ?? "" })}
        </p>
      </ConfirmDialog>
    </>
  );
}

interface ExportCurrentProps {
  /** Whether a life in progress is stored: known from the start screen's offer, so rendering reads nothing. */
  available: boolean;
  onExport: GameStore["exportCurrent"];
  onNotice: (text: string) => void;
  save?: SaveText;
}

/** "Save the life in progress to a file"; off, with the reason, when there is none. */
export function ExportCurrent({ available, onExport, onNotice, save = downloadText }: ExportCurrentProps) {
  function press() {
    const file = onExport();
    onNotice(
      file && save(file.fileName, file.text) ? t("files.saved", { fileName: file.fileName }) : t("files.saveFailed"),
    );
  }
  return (
    <>
      <Button isDisabled={!available} onPress={press}>
        {t("files.current.save")}
      </Button>
      {!available && <p className="small">{t("files.current.none")}</p>}
    </>
  );
}

interface ExportPastProps {
  life: { id: string; name: string };
  onExport: GameStore["exportPastLife"];
  onNotice: (text: string) => void;
  save?: SaveText;
}

/** A finished life's "Save to file", for its card. */
export function ExportPastLife({ life, onExport, onNotice, save = downloadText }: ExportPastProps) {
  async function press() {
    const file = await onExport(life.id);
    onNotice(
      file && save(file.fileName, file.text)
        ? t("files.savedPast", { name: life.name, fileName: file.fileName })
        : t("files.saveFailed"),
    );
  }
  return (
    <Button aria-label={t("files.past.saveLabel", { name: life.name })} onPress={() => void press()}>
      {t("files.past.save")}
    </Button>
  );
}

interface FilesProps {
  canExportCurrent: boolean;
  onExportCurrent: GameStore["exportCurrent"];
  onImport: GameStore["importLife"];
  save?: SaveText;
}

/** The settings screen's part: the blurb, the two buttons and one status region. */
export function LifeFiles({ canExportCurrent, onExportCurrent, onImport, save }: FilesProps) {
  const { region, say } = useNotice();
  return (
    <div className={styles.files}>
      <p className="small">{t("files.about")}</p>
      <div className={styles.buttons}>
        <ExportCurrent available={canExportCurrent} onExport={onExportCurrent} onNotice={say} save={save} />
        <ImportLife onImport={onImport} onNotice={say} />
      </div>
      {region}
    </div>
  );
}
