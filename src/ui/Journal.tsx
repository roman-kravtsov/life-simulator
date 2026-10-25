// The journal (UI-007, SUM-005): a line the player may write in a year, answering a reflection prompt or of their own,
// and the lines already written. Nothing here asks for an answer: a field left empty is never mentioned, and the year
// goes on without it. Saving is said in a polite paragraph that is on the page before its words arrive, and focus
// stays where the player put it.
import { useState, type FormEvent, type Ref } from "react";
import type { JournalEntry } from "../engine/types";
import { formatNumber, pluralKey } from "../format";
import { hasString, t } from "../i18n";
import styles from "./Journal.module.css";
import { Button, Dialog, TextField } from "./kit";
import { JOURNAL_MAX_LENGTH, promptTextKey } from "./store";

interface JournalLineProps {
  label: string;
  /** `prose` sets the label as a line of the story, for a prompt; the label is the field's name either way. */
  labelStyle?: "field" | "prose";
  /** The line as kept, if there is one. */
  written: string | undefined;
  /** What is being written and not saved yet; undefined when the field shows the line as kept. */
  draft: string | undefined;
  /** The caller keeps the draft, so it survives the field leaving the page (another tab) within the year. */
  onDraft: (text: string | undefined) => void;
  onSave: (text: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}

/** One line of the journal: a labelled single-line field with the characters left, Save, and a polite note. */
export function JournalLine({ label, labelStyle, written, draft, onDraft, onSave, inputRef }: JournalLineProps) {
  // Each announcement is a new node in the live region, so the same words said twice are heard twice.
  const [spoken, setSpoken] = useState({ text: "", n: 0 });
  const value = draft ?? written ?? "";
  const left = JOURNAL_MAX_LENGTH - value.length;
  const say = (text: string) => setSpoken((was) => ({ text, n: was.n + 1 }));

  function save(event: FormEvent) {
    event.preventDefault();
    const hasWords = value.trim() !== "";
    if (!hasWords && !written) {
      say(t("journal.empty"));
      return;
    }
    onSave(value);
    // The field now shows the line as the store keeps it (tidied), or nothing once it is removed.
    onDraft(undefined);
    say(t(hasWords ? "journal.saved" : "journal.removed"));
  }

  /** Typing says nothing, except once when the last character is used, and what was said is cleared as it goes. */
  function change(next: string) {
    const full = next.length === JOURNAL_MAX_LENGTH;
    setSpoken((was) => {
      if (full && value.length !== JOURNAL_MAX_LENGTH) return { text: t("journal.limit"), n: was.n + 1 };
      // Still at the limit: what was said stays, as the same node, so it is not said again.
      if (full) return was;
      return { text: "", n: was.n + 1 };
    });
    onDraft(next);
  }

  return (
    <form onSubmit={save} className={styles.line}>
      <TextField
        label={label}
        labelStyle={labelStyle}
        description={t(pluralKey("journal.left", left), { count: formatNumber(left) })}
        maxLength={JOURNAL_MAX_LENGTH}
        value={value}
        onChange={change}
        inputRef={inputRef}
      />
      <div className={styles.actions}>
        <Button type="submit">{t("journal.save")}</Button>
        <p className={`small ${styles.said}`} aria-live="polite">
          {spoken.text && <span key={spoken.n}>{spoken.text}</span>}
        </p>
      </div>
    </form>
  );
}

/** The words of the prompt a line answered, or null when it answered none or this version no longer has it. */
function promptWords(entry: JournalEntry): string | null {
  if (!entry.prompt) return null;
  const key = promptTextKey(entry.prompt);
  return key && hasString(key) ? t(key) : null;
}

interface EntriesProps {
  entries: readonly JournalEntry[];
  /** `compact` keeps each line to one row, cut short by CSS, with the whole line in its title (the side column). */
  variant?: "compact" | "full";
  className?: string;
}

/** Journal lines as a list: the age, the prompt a line answered (small, above it), then the line. */
export function JournalEntries({ entries, variant = "full", className }: EntriesProps) {
  const compact = variant === "compact";
  return (
    <ul className={[styles.entries, compact ? styles.compact : "", className].filter(Boolean).join(" ")}>
      {entries.map((entry) => {
        const words = promptWords(entry);
        return (
          <li key={`${entry.age}-${entry.prompt ?? ""}`} className={styles.entry}>
            <p className={styles.age}>{t("journal.age", { age: entry.age })}</p>
            <div>
              {words && (
                <p className={styles.prompt} title={compact ? words : undefined}>
                  {words}
                </p>
              )}
              <p className={styles.text} title={compact ? entry.text : undefined}>
                {entry.text}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** How many of the latest lines the Notes tab shows; the rest are in the dialog. */
const LATEST = 3;

interface NotesPanelProps {
  journal: readonly JournalEntry[];
  /** The age being lived: the field is for this year's own line. */
  age: number;
  draft: string | undefined;
  onDraft: (text: string | undefined) => void;
  /** Saves the player's own line for this year (no prompt). */
  onSave: (text: string) => void;
  /** The field, so the Journal button can send focus to it. */
  inputRef: Ref<HTMLInputElement>;
  /** The narrow layout, where the column is the page's width and the lines are shown whole. */
  narrow: boolean;
}

/**
 * The Notes tab (UI-004, UI-007): a line of the player's own for this year, then the latest lines, newest first, one
 * row each in the wide side column (whole in the narrow layout, which scrolls with the page). The whole journal is a press away in a dialog, from the first line on, so a line cut short here can
 * always be read in full.
 */
export function NotesPanel({ journal, age, draft, onDraft, onSave, inputRef, narrow }: NotesPanelProps) {
  const own = journal.find((entry) => entry.age === age && !entry.prompt)?.text;
  const newest = [...journal].reverse();
  return (
    <div className={styles.notes}>
      <JournalLine
        key={age}
        label={t("notes.own")}
        written={own}
        draft={draft}
        onDraft={onDraft}
        onSave={onSave}
        inputRef={inputRef}
      />
      {journal.length === 0 ? (
        <p className="small">{t("notes.none")}</p>
      ) : (
        <>
          <h3 className={styles.heading}>{t("notes.latest")}</h3>
          <JournalEntries entries={newest.slice(0, LATEST)} variant={narrow ? "full" : "compact"} />
          <div>
            <Dialog
              title={t("notes.dialog.title")}
              closeLabel={t("notes.dialog.close")}
              trigger={
                <Button>{t(pluralKey("notes.all", journal.length), { count: formatNumber(journal.length) })}</Button>
              }
            >
              <JournalEntries entries={newest} />
            </Dialog>
          </div>
        </>
      )}
    </div>
  );
}
