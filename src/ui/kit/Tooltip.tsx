import type { ReactNode } from "react";
import { Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components";
import styles from "./Tooltip.module.css";

export interface TooltipProps {
  /** The text shown on hover or keyboard focus. */
  text: string;
  /** One focusable element, such as a Button. */
  children: ReactNode;
}

/** A short hint that appears on hover and keyboard focus. Used for the odds lens. */
export function Tooltip({ text, children }: TooltipProps) {
  return (
    <TooltipTrigger delay={300} closeDelay={100}>
      {children}
      <AriaTooltip className={styles.tooltip} offset={8}>
        {text}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
