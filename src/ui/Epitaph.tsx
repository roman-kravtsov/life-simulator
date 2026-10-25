// The few words the player may leave for the person (DEATH-004): a field to write them in, then the words as
// a quotation with a way to change them. Saving is announced politely and focus never falls to the page.
import { useId, useState, type FormEvent } from "react";
import { pluralKey, formatNumber } from "../format";
import { t } from "../i18n";
import styles from "./Epitaph.module.css";
import { Button, TextField } from "./kit";
import { EPITAPH_MAX_LENGTH } from "./store";

interface Props {
  name: string;
  /** The words as kept, if there are any. */
  epitaph: string | undefined;
  onSave: (text: string) => void;
}

export function Epitaph({ name, epitaph, onSave }: Props) {
  const headingId = useId();
  const [editing, setEditing] = useState(!epitaph);
  const [draft, setDraft] = useState(epitaph ?? "");
  /** True after the player has acted here, when a control that appears should take focus; never on arrival. */
  const [acted, setActed] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const left = EPITAPH_MAX_LENGTH - draft.length;
  const hasWords = draft.trim() !== "";

  function save(event: FormEvent) {
    event.preventDefault();
    // Nothing to save when there was nothing and still is nothing: say so, so a press is never silent.
    if (!hasWords && !epitaph) {
      setAnnouncement(t("summary.epitaph.empty"));
      return;
    }
    onSave(draft);
    setActed(true);
    setEditing(!hasWords);
    setAnnouncement(t(hasWords ? "summary.epitaph.saved" : "summary.epitaph.removed", { name }));
    if (!hasWords) setDraft("");
  }

  /** Typing says nothing, except once when the last character is used, and what was said is cleared as it goes. */
  function change(next: string) {
    const full = next.length === EPITAPH_MAX_LENGTH;
    setAnnouncement(
      full && draft.length !== EPITAPH_MAX_LENGTH ? t("summary.epitaph.limit") : full ? announcement : "",
    );
    setDraft(next);
  }

  function edit() {
    setDraft(epitaph ?? "");
    setActed(true);
    setEditing(true);
    setAnnouncement("");
  }

  function cancel() {
    setDraft(epitaph ?? "");
    setActed(true);
    setEditing(false);
  }

  return (
    <section aria-labelledby={headingId} className={styles.epitaph}>
      <h2 id={headingId} className="eyebrow">
        {t("summary.epitaph.heading")}
      </h2>
      {editing ? (
        <form onSubmit={save} className={styles.form}>
          {!epitaph && <p>{t("summary.epitaph.intro", { name })}</p>}
          <TextField
            label={t("summary.epitaph.label", { name })}
            description={t(pluralKey("summary.epitaph.left", left), { count: formatNumber(left) })}
            maxLength={EPITAPH_MAX_LENGTH}
            value={draft}
            onChange={change}
            autoFocus={acted}
          />
          <div className={styles.actions}>
            <Button type="submit" variant="primary" aria-disabled={!hasWords && !epitaph ? true : undefined}>
              {t("summary.epitaph.save")}
            </Button>
            {epitaph && <Button onPress={cancel}>{t("summary.epitaph.cancel")}</Button>}
          </div>
        </form>
      ) : (
        <>
          <blockquote className={styles.quote}>{epitaph}</blockquote>
          <Button onPress={edit} autoFocus={acted}>
            {t("summary.epitaph.edit")}
          </Button>
        </>
      )}
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
