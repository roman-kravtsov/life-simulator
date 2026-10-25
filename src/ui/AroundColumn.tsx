// The column around the person (UI-004): family, the country in a few measured facts, and the notes (UI-007). In the
// wide layout it is sticky beside the story and has to fit a short window without scrolling; in the narrow layout it
// is one of the three tabs.
import { useId, type ReactNode } from "react";
import type { Sex } from "../engine/types";
import type { Country, CountryIndex } from "../engine/world/types";
import { t } from "../i18n";
import { TabPanel, Tabs } from "./kit";
import { CountryPanel, FamilyPanel } from "./LifePanels";
import styles from "./SideColumn.module.css";
import type { CountryFacts, FamilySummary } from "./store";

interface Props {
  family: FamilySummary;
  facts: CountryFacts;
  sex: Sex;
  country: Pick<Country, "iso2" | "name">;
  sources: CountryIndex["sources"];
  tab: string;
  onTab: (tab: string) => void;
  /** The Notes tab's content (the journal), which the life screen holds, since the Journal button sends focus there. */
  notes: ReactNode;
  narrow: boolean;
}

export function AroundColumn({ family, facts, sex, country, sources, tab, onTab, notes, narrow }: Props) {
  const headingId = useId();
  const tabs = [
    { id: "family", label: t("life.tab.family") },
    { id: "country", label: t("life.tab.country") },
    { id: "notes", label: t("life.tab.notes") },
  ];
  return (
    <aside aria-labelledby={headingId} className={`${styles.column} ${narrow ? styles.flow : styles.sticky}`}>
      <h2 id={headingId} className={`eyebrow ${styles.heading}`}>
        {t("life.around")}
      </h2>
      <Tabs
        label={t("life.tabs.around")}
        tabs={tabs}
        selectedKey={tab}
        onSelectionChange={onTab}
        className={styles.tabs}
      >
        <TabPanel id="family" className={styles.panel}>
          <FamilyPanel family={family} />
        </TabPanel>
        <TabPanel id="country" className={styles.panel}>
          <CountryPanel facts={facts} sex={sex} country={country} sources={sources} />
        </TabPanel>
        <TabPanel id="notes" className={styles.panel}>
          {notes}
        </TabPanel>
      </Tabs>
    </aside>
  );
}
