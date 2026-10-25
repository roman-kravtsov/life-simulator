// The column about the person (UI-004): the rings as a thumbnail, the four stats, and tabs for school and work, money
// and health. In the wide layout it is sticky beside the story and has to fit a short window without scrolling, so
// the tab panels share what is left and the type is small; in the narrow layout it is one of the three tabs.
import type { Ring } from "../engine/rings";
import type { Person, StatId } from "../engine/types";
import { formatNumber, pluralKey } from "../format";
import { t } from "../i18n";
import { TabPanel, Tabs } from "./kit";
import { HealthPanel, MoneyPanel, SchoolWorkPanel } from "./LifePanels";
import { RingsThumb } from "./RingsThumb";
import styles from "./SideColumn.module.css";
import { statBand, type LifeOverview } from "./store";

const STATS: readonly StatId[] = ["health", "happiness", "belonging", "skills"];

interface Props {
  stats: Person["stats"];
  rings: readonly Ring[];
  overview: LifeOverview;
  showUsPrices: boolean;
  onToggleUsPrices: () => void;
  tab: string;
  onTab: (tab: string) => void;
  /** The narrow layout: not sticky, and its panels as tall as they need to be. */
  narrow: boolean;
}

export function YouColumn({ stats, rings, overview, showUsPrices, onToggleUsPrices, tab, onTab, narrow }: Props) {
  const { education, literacy, work, money, conditions } = overview;
  const tabs = [
    { id: "school", label: t("life.tab.school") },
    { id: "money", label: t("life.tab.money") },
    { id: "health", label: t("life.tab.health") },
  ];
  return (
    <aside aria-label={t("life.you.aria")} className={`${styles.column} ${narrow ? styles.flow : styles.sticky}`}>
      <div className={styles.ringRow}>
        <RingsThumb rings={rings} />
        <div>
          <h2 className={`eyebrow ${styles.heading}`}>{t("life.you.heading")}</h2>
          <p className={`small ${styles.caption}`}>
            {rings.length === 0
              ? t("life.you.rings.none")
              : t(pluralKey("life.you.rings", rings.length), { count: formatNumber(rings.length) })}
          </p>
        </div>
      </div>
      <ul className={styles.stats}>
        {STATS.map((id) => {
          const value = Math.round(stats[id]);
          const label = t(`life.stat.${id}`);
          return (
            <li key={id} className={styles.stat}>
              {/* The meter's name carries the label, the number and a word, so the text beside it is only for the eye. */}
              <span aria-hidden="true">{label}</span>
              <meter
                className={styles.meter}
                min={0}
                max={100}
                value={value}
                aria-label={t("life.stat.meter", { stat: label, value, band: t(`life.statBand.${statBand(value)}`) })}
              />
              <span aria-hidden="true" className={styles.value}>
                {value}
              </span>
            </li>
          );
        })}
      </ul>
      <Tabs label={t("life.tabs.you")} tabs={tabs} selectedKey={tab} onSelectionChange={onTab} className={styles.tabs}>
        <TabPanel id="school" className={styles.panel}>
          <SchoolWorkPanel education={education} literacy={literacy} work={work} />
        </TabPanel>
        <TabPanel id="money" className={styles.panel}>
          <MoneyPanel money={money} showUsPrices={showUsPrices} onToggleUsPrices={onToggleUsPrices} />
        </TabPanel>
        <TabPanel id="health" className={styles.panel}>
          <HealthPanel conditions={conditions} />
        </TabPanel>
      </Tabs>
    </aside>
  );
}
