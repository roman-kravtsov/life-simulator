import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import styles from "./Button.module.css";

type Variant = "primary" | "ghost";

export interface ButtonProps extends Omit<AriaButtonProps, "className"> {
  variant?: Variant;
  /** Square, icon-only button. The caller must supply an aria-label. */
  icon?: boolean;
}

export function Button({ variant = "ghost", icon = false, ...props }: ButtonProps) {
  const className = [styles.button, styles[variant], icon ? styles.icon : ""].filter(Boolean).join(" ");
  return <AriaButton {...props} className={className} />;
}
