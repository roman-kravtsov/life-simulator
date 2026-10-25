import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { t } from "../i18n";
import { BirthScreen } from "./BirthScreen";
import { DEFAULT_DISPLAY, displayStore, type Display, type DisplayStore } from "./display";
import { LifeScreen } from "./LifeScreen";
import { PastLivesScreen } from "./PastLivesScreen";
import { ScreenBoundary } from "./ScreenBoundary";
import { SettingsScreen } from "./SettingsScreen";
import { SourcesScreen } from "./SourcesScreen";
import { StartScreen } from "./StartScreen";
import { SummaryScreen } from "./SummaryScreen";
import type { GameStore } from "./store";

const isDefaultDisplay = (display: Display) =>
  (Object.keys(DEFAULT_DISPLAY) as (keyof Display)[]).every((name) => display[name] === DEFAULT_DISPLAY[name]);

function CurrentScreen({ store, display }: { store: GameStore; display: DisplayStore }) {
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
    reflection,
    statChanges,
    summary,
    resume,
    pastLives,
    problem,
    restored,
    deleted,
  } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  // A display preference the reader chose is kept in this browser too, so it is something "delete all" removes.
  const preferencesStored = useSyncExternalStore(display.subscribe, () => !isDefaultDisplay(display.getSnapshot()));
  // The screens that show stored lives are guarded, so text a version no longer has cannot blank the app.
  const guarded = (element: ReactNode) => (
    <ScreenBoundary key={screen} onBack={store.backToStart}>
      {element}
    </ScreenBoundary>
  );
  if (screen === "birth" && life && country) {
    return (
      <BirthScreen
        life={life}
        country={country}
        sources={sources ?? {}}
        onContinue={store.startLife}
        onBack={store.backToStart}
      />
    );
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
        reflection={reflection}
        statChanges={statChanges}
        onToggleUsPrices={store.toggleUsPrices}
        onContinue={store.continueYear}
        onChoose={store.choose}
        onJournal={store.writeJournal}
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
        canDeleteAll={(pastLives?.length ?? 0) > 0 || resume !== null || preferencesStored}
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
  if (screen === "settings") {
    return (
      <SettingsScreen
        settings={settings}
        onSettings={store.setSettings}
        // The past lives are unknown here until they have been looked at, so there may be some.
        canDeleteAll={pastLives === null || pastLives.length > 0 || resume !== null || preferencesStored}
        onDeleteAll={store.deleteAllData}
        onBack={store.closeSettings}
        display={display}
      />
    );
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
      onOpenSettings={store.openSettings}
      onSources={store.openSources}
    />
  );
}

interface AppProps {
  store: GameStore;
  /** The reader's display preferences (UI-009); the page's own unless a test gives its own. */
  display?: DisplayStore;
}

export function App({ store, display = displayStore }: AppProps) {
  // "Delete all local data" removes the stored preferences with everything else; the page then goes back to the
  // defaults too. In one place, for every screen that offers it (past lives, settings).
  const deleted = useSyncExternalStore(store.subscribe, () => store.getSnapshot().deleted);
  useEffect(() => {
    if (deleted) display.reset();
  }, [deleted, display]);
  // Every screen renders through Page: its header, then <main id="content">, where the skip link leads (UI-010).
  return (
    <>
      <a className="skip-link" href="#content">
        {t("app.skipToContent")}
      </a>
      <CurrentScreen store={store} display={display} />
    </>
  );
}
