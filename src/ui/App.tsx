import { useSyncExternalStore } from "react";
import { t } from "../i18n";
import { LifeScreen } from "./LifeScreen";
import { SourcesScreen } from "./SourcesScreen";
import { StartScreen } from "./StartScreen";
import type { GameStore } from "./store";

function CurrentScreen({ store }: { store: GameStore }) {
  const { screen, life } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (screen === "life" && life) {
    // Not keyed by year: the status region must stay mounted for screen readers to announce changes.
    return <LifeScreen life={life} onContinue={store.continueYear} onBack={store.backToStart} />;
  }
  if (screen === "sources") {
    return <SourcesScreen onBack={store.closeSources} />;
  }
  return <StartScreen onBegin={store.begin} onSources={store.openSources} />;
}

export function App({ store }: { store: GameStore }) {
  return (
    <>
      <a className="skip-link" href="#content">
        {t("app.skipToContent")}
      </a>
      <div id="content" tabIndex={-1}>
        <CurrentScreen store={store} />
      </div>
    </>
  );
}
