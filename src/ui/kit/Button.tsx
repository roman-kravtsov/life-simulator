import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import styles from "./Button.module.css";

/** `choice` is a full-width option the player picks from a list, such as an answer on a decision card. */
type Variant = "primary" | "ghost" | "choice";

export interface ButtonProps extends Omit<AriaButtonProps, "className"> {
  variant?: Variant;
  /** Square, icon-only button. The caller must supply an aria-label. */
  icon?: boolean;
}

export function Button({ variant = "ghost", icon = false, ...props }: ButtonProps) {
  const className = [styles.button, styles[variant], icon ? styles.icon : ""].filter(Boolean).join(" ");
  return <AriaButton {...props} className={className} />;
}
