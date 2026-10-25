import { FieldError, Input, Label, Text, TextField as AriaTextField, type TextFieldProps } from "react-aria-components";
import styles from "./TextField.module.css";

export interface TextFieldPropsWithLabel extends Omit<TextFieldProps, "className" | "children"> {
  label: string;
  /** Shown under the field and read after the label by screen readers, for a hint such as the characters left. */
  description?: string;
}

/** A labelled single-line text field with an optional hint tied to the input. Used for the epitaph (DEATH-004). */
export function TextField({ label, description, ...props }: TextFieldPropsWithLabel) {
  return (
    <AriaTextField {...props} className={styles.field}>
      <Label className={styles.label}>{label}</Label>
      <Input className={styles.input} />
      {description && (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      )}
      <FieldError className={styles.description} />
    </AriaTextField>
  );
}
