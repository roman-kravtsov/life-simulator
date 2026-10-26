import type { Ref } from "react";
import { FieldError, Input, Label, Text, TextField as AriaTextField, type TextFieldProps } from "react-aria-components";
import styles from "./TextField.module.css";

export interface TextFieldPropsWithLabel extends Omit<TextFieldProps, "className" | "children"> {
  label: string;
  /** Shown under the field and read after the label by screen readers, for a hint such as the characters left. */
  description?: string;
  /**
   * `field` is the usual short label, set in the interface type. `prose` sets the label as a line of the story, for a
   * question the field answers (a reflection prompt, UI-007): it is still the field's label.
   */
  labelStyle?: "field" | "prose";
  /** The input itself, so a control elsewhere can send focus to it (the Journal button, UI-004). */
  inputRef?: Ref<HTMLInputElement>;
}

/** A labelled single-line text field with an optional hint tied to the input: the epitaph (DEATH-004), the journal (UI-007). */
export function TextField({ label, description, labelStyle = "field", inputRef, ...props }: TextFieldPropsWithLabel) {
  return (
    <AriaTextField {...props} className={styles.field}>
      <Label className={labelStyle === "prose" ? styles.prose : styles.label}>{label}</Label>
      <Input ref={inputRef} className={styles.input} />
      {description && (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      )}
      <FieldError className={styles.description} />
    </AriaTextField>
  );
}
