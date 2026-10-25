import { useSyncExternalStore, type ReactNode } from "react";
import { t } from "../i18n";
import { BirthScreen } from "./BirthScreen";
import { LifeScreen } from "./LifeScreen";
import { PastLivesScreen } from "./PastLivesScreen";
import { ScreenBoundary } from "./ScreenBoundary";
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
    deleted,
  } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  // The screens that show stored lives are guarded, so text a version no longer has cannot blank the app.
  const guarded = (element: ReactNode) => (
    <ScreenBoundary key={screen} onBack={store.backToStart}>
      {element}
    </ScreenBoundary>
  );
  if (screen === "birth" && life && country) {
    return <BirthScreen life={life} country={country} onContinue={store.startLife} />;
  }
  if (screen === "life" && life && country) {
    // Not keyed by year: the status region must stay mounted for screen readers to announce changes.
    return guarded(
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
      />,
    );
  }
  if (screen === "summary" && summary) {
    return guarded(
      <SummaryScreen
        view={summary}
        sources={sources ?? {}}
        problem={problem}
        onEpitaph={store.writeEpitaph}
        onAnother={store.begin}
        onPast={store.openPast}
        onBack={store.backToStart}
      />,
    );
  }
  if (screen === "past") {
    return guarded(
      <PastLivesScreen
        lives={pastLives}
        problem={problem === "archive"}
        canDeleteAll={(pastLives?.length ?? 0) > 0 || resume !== null}
        onOpen={store.openPastLife}
        onDelete={store.deletePastLife}
        onDeleteAll={store.deleteAllData}
        onBack={store.backToStart}
      />,
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
      deleted={deleted}
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
  // The life screen runs the width of the window, in columns; every other screen keeps the reading measure (UI-010).
  const wide = useSyncExternalStore(store.subscribe, () => {
    const { screen, life, country } = store.getSnapshot();
    return screen === "life" && life !== null && country !== null;
  });
  return (
    <>
      <a className="skip-link" href="#content">
        {t("app.skipToContent")}
      </a>
      <div id="content" tabIndex={-1} data-layout={wide ? "wide" : undefined}>
        <CurrentScreen store={store} />
      </div>
    </>
  );
}
