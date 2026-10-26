import {
  Label,
  RadioButton,
  RadioField,
  RadioGroup as AriaRadioGroup,
  Text,
  type RadioGroupProps as AriaRadioGroupProps,
} from "react-aria-components";
import styles from "./RadioGroup.module.css";

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  /** A line under the option, tied to its radio. */
  description?: string;
}

export interface RadioGroupProps<T extends string> extends Omit<
  AriaRadioGroupProps,
  "className" | "children" | "value" | "defaultValue" | "onChange"
> {
  label: string;
  /** A line under the label, tied to the group. */
  description?: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * One choice from a few, shown all at once: a labelled group, one tab stop, the arrow keys move and choose. Each option
 * is a 2.75rem target with a ring for its state (filled when chosen), so the choice never rests on colour alone.
 */
export function RadioGroup<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
  ...props
}: RadioGroupProps<T>) {
  return (
    <AriaRadioGroup
      {...props}
      value={value}
      onChange={(next) => {
        const chosen = options.find((option) => option.value === next);
        if (chosen) onChange(chosen.value);
      }}
      className={styles.group}
    >
      <Label className={styles.label}>{label}</Label>
      {description && (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      )}
      <div className={styles.options}>
        {options.map((option) => (
          <RadioField key={option.value} value={option.value} className={styles.field}>
            <RadioButton className={styles.radio}>
              <span className={styles.mark} aria-hidden="true" />
              <span>{option.label}</span>
            </RadioButton>
            {option.description && (
              <Text slot="description" className={styles.description}>
                {option.description}
              </Text>
            )}
          </RadioField>
        ))}
      </div>
    </AriaRadioGroup>
  );
}
