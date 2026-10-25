import type { ReactNode } from "react";
import { Tab, TabList, TabPanel as AriaTabPanel, Tabs as AriaTabs } from "react-aria-components";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  /** Names the tab list for screen readers. */
  label: string;
  tabs: readonly TabItem[];
  /** Tabs are controlled: the caller keeps the selected id. */
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  /**
   * `underline` is a row of tabs above its panel (the side columns of the life screen). `bar` is the same row docked
   * to the bottom of the screen, for the narrow layout (UI-010). It stays first in the page, as React Aria needs the
   * list before its panels, and the caller leaves room for it under its content.
   */
  variant?: "underline" | "bar";
  /** For the caller's layout of the whole: tabs and panels together. */
  className?: string;
  /** `TabPanel`s, one for each tab. */
  children: ReactNode;
}

/**
 * A row of tabs and their panels. Arrow keys, Home and End move between the tabs and select them; only the selected
 * panel is in the page unless a panel asks to stay mounted. Used for the side columns and the narrow layout of
 * the life screen (UI-004, UI-010).
 */
export function Tabs({
  label,
  tabs,
  selectedKey,
  onSelectionChange,
  variant = "underline",
  className,
  children,
}: TabsProps) {
  const list = (
    <TabList aria-label={label} className={`${styles.list} ${styles[variant]}`}>
      {tabs.map((tab) => (
        <Tab key={tab.id} id={tab.id} className={styles.tab}>
          {tab.label}
        </Tab>
      ))}
    </TabList>
  );
  return (
    <AriaTabs
      selectedKey={selectedKey}
      onSelectionChange={(key) => onSelectionChange(String(key))}
      className={className}
    >
      {list}
      {children}
    </AriaTabs>
  );
}

export interface TabPanelProps {
  /** The id of the tab it belongs to; the tab's name is the panel's name. */
  id: string;
  /**
   * Keeps the panel in the page when its tab is not selected, hidden from sight and from assistive technology, so what
   * is in it keeps its state and place.
   */
  forceMount?: boolean;
  className?: string;
  children: ReactNode;
}

export function TabPanel({ className, forceMount, ...props }: TabPanelProps) {
  return (
    <AriaTabPanel
      {...props}
      shouldForceMount={forceMount}
      className={[styles.panel, className].filter(Boolean).join(" ")}
    />
  );
}
