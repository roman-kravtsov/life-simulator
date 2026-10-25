import {
  Button,
  FieldError,
  Group,
  Input,
  Label,
  NumberField,
  Text,
  type NumberFieldProps,
} from "react-aria-components";
import styles from "./Stepper.module.css";

export interface StepperProps extends Omit<
  NumberFieldProps,
  "className" | "children" | "formatOptions" | "isWheelDisabled" | "step"
> {
  label: string;
  /** Shown under the label and read after it by screen readers. */
  description?: string;
  /** More to say about this field now (why it is locked, say), always seen, and read with the description. */
  note?: string;
  /**
   * A narrow, stacked form for a row of steppers: the description is for screen readers only and is not shown, the
   * note still is. Used for the plan tray (UI-005).
   */
  compact?: boolean;
}

/**
 * A labelled whole-number stepper: arrow keys on the field for keyboard and screen-reader users, minus
 * and plus buttons for touch. Used to place the yearly focus points (UI-005).
 */
export function Stepper({ label, description, note, compact = false, ...props }: StepperProps) {
  return (
    <NumberField
      {...props}
      step={1}
      isWheelDisabled
      className={compact ? `${styles.stepper} ${styles.compact}` : styles.stepper}
    >
      <Label className={styles.label}>{label}</Label>
      <Group className={styles.group}>
        <Button slot="decrement" className={styles.button}>
          <span aria-hidden="true">−</span>
        </Button>
        <Input className={styles.input} />
        <Button slot="increment" className={styles.button}>
          <span aria-hidden="true">+</span>
        </Button>
      </Group>
      {(description || note) && (
        <Text slot="description" className={styles.description}>
          {description && <span className={compact ? "visually-hidden" : undefined}>{description}</span>}
          {description && note && " "}
          {note && <span>{note}</span>}
        </Text>
      )}
      <FieldError className={styles.description} />
    </NumberField>
  );
}
