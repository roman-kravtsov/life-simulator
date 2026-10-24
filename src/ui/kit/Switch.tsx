import type { ReactNode } from "react";
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from "react-aria-components";
import styles from "./Switch.module.css";

export interface SwitchProps extends Omit<AriaSwitchProps, "className" | "children"> {
  children: ReactNode;
}

/** A labelled on/off setting. Pass the label as children. */
export function Switch({ children, ...props }: SwitchProps) {
  return (
    <AriaSwitch {...props} className={styles.switch}>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span>{children}</span>
    </AriaSwitch>
  );
}
