import { useSyncExternalStore } from "react";
import { t } from "../i18n";
import { BirthScreen } from "./BirthScreen";
import { LifeScreen } from "./LifeScreen";
import { PastLivesScreen } from "./PastLivesScreen";
import { SourcesScreen } from "./SourcesScreen";
import { StartScreen } from "./StartScreen";
import { SummaryScreen } from "./SummaryScreen";
import type { GameStore } from "./store";

function CurrentScreen({ store }: { store: GameStore }) {
  const {
    screen,
    life,
    country,
    sources,
    status,
    showUsPrices,
    settings,
    card,
    plan,
    quietRun,
    summary,
    resume,
    pastLives,
    problem,
    restored,
  } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (screen === "birth" && life && country) {
    return <BirthScreen life={life} country={country} onContinue={store.startLife} />;
  }
  if (screen === "life" && life && country) {
    // Not keyed by year: the status region must stay mounted for screen readers to announce changes.
    return (
      <LifeScreen
        life={life}
        country={country}
        sources={sources ?? {}}
        showUsPrices={showUsPrices}
        card={card}
        plan={plan}
        quietRun={quietRun}
        restored={restored}
        problem={problem}
        onToggleUsPrices={store.toggleUsPrices}
        onContinue={store.continueYear}
        onChoose={store.choose}
        onSettings={store.setSettings}
        onBack={store.backToStart}
      />
    );
  }
  if (screen === "summary" && summary) {
    return (
      <SummaryScreen
        view={summary}
        sources={sources ?? {}}
        problem={problem}
        onEpitaph={store.writeEpitaph}
        onAnother={store.begin}
        onPast={store.openPast}
        onBack={store.backToStart}
      />
    );
  }
  if (screen === "past") {
    return (
      <PastLivesScreen
        lives={pastLives}
        problem={problem === "archive"}
        canDeleteAll={(pastLives?.length ?? 0) > 0 || resume !== null}
        onOpen={store.openPastLife}
        onDelete={store.deletePastLife}
        onDeleteAll={store.deleteAllData}
        onBack={store.backToStart}
      />
    );
  }
  if (screen === "sources") {
    return <SourcesScreen onBack={store.closeSources} />;
  }
  return (
    <StartScreen
      status={status}
      settings={settings}
      resume={resume}
      onSettings={store.setSettings}
      onBegin={store.begin}
      onResume={store.resumeLife}
      onDiscard={store.discardSaved}
      onPast={store.openPast}
      onSources={store.openSources}
    />
  );
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
