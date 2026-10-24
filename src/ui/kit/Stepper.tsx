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
}

/**
 * A labelled whole-number stepper: arrow keys on the field for keyboard and screen-reader users, minus
 * and plus buttons for touch. Used to place the yearly focus points (UI-005).
 */
export function Stepper({ label, description, ...props }: StepperProps) {
  return (
    <NumberField {...props} step={1} isWheelDisabled className={styles.stepper}>
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
      {description && (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      )}
      <FieldError className={styles.description} />
    </NumberField>
  );
}
