import { useSyncExternalStore } from "react";
import { t } from "../i18n";
import { LifeScreen } from "./LifeScreen";
import { StartScreen } from "./StartScreen";
import type { GameStore } from "./store";

export function App({ store }: { store: GameStore }) {
  const { screen, life } = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return (
    <>
      <a className="skip-link" href="#content">
        {t("app.skipToContent")}
      </a>
      <div id="content" tabIndex={-1}>
        {screen === "life" && life ? (
          // Not keyed by year: the status region must stay mounted for screen readers to announce changes.
          <LifeScreen life={life} onContinue={store.continueYear} onBack={store.backToStart} />
        ) : (
          <StartScreen onBegin={store.begin} />
        )}
      </div>
    </>
  );
}
