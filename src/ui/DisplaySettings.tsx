// How the page looks (UI-009, UI-011, A11Y-004, A11Y-005): the theme, the size of the text and whether to hold back
// motion. These belong to the reader, not to a life, so they live in display.ts and not in the game store; the settings
// screen and the life screen's settings dialog both show this. The style sheet reads what display.ts puts on <html>.
import { useId, useSyncExternalStore } from "react";
import { t } from "../i18n";
import {
  displayStore,
  motionChoice,
  reducesMotion,
  subscribeSystemMotion,
  systemReducesMotion,
  TEXT_SIZES,
  THEMES,
  type DisplayStore,
} from "./display";
import styles from "./DisplaySettings.module.css";
import { RadioGroup, Switch } from "./kit";

interface Props {
  /** Injected in tests; the page's own preferences otherwise. */
  store?: DisplayStore;
  /** 2 on a page; 3 in the life screen's settings dialog, under its title. */
  headingLevel?: 2 | 3;
}

export function DisplaySettings({ store = displayStore, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const display = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const headingId = useId();
  const motionAbout = useId();
  // The system's preference can change while the game is open, and the switch says what holds now.
  const systemReduces = useSyncExternalStore(subscribeSystemMotion, systemReducesMotion);
  return (
    <section aria-labelledby={headingId} className={styles.display}>
      <Heading id={headingId} className={`eyebrow ${styles.heading}`}>
        {t("display.heading")}
      </Heading>
      <RadioGroup
        label={t("display.theme")}
        description={t("display.theme.about")}
        options={THEMES.map((theme) => ({ value: theme, label: t(`display.theme.${theme}`) }))}
        value={display.theme}
        onChange={(theme) => store.set({ theme })}
      />
      <RadioGroup
        label={t("display.textSize")}
        description={t("display.textSize.about")}
        options={TEXT_SIZES.map((size) => ({ value: size, label: t(`display.textSize.${size}`) }))}
        value={display.textSize}
        onChange={(textSize) => store.set({ textSize })}
      />
      <div>
        <Switch
          isSelected={reducesMotion(display, systemReduces)}
          onChange={(on) => store.set({ motion: motionChoice(on, systemReduces) })}
          aria-describedby={motionAbout}
        >
          {t("display.motion")}
        </Switch>
        <p id={motionAbout} className={`small ${styles.about}`}>
          {t("display.motion.about")}
        </p>
      </div>
    </section>
  );
}
