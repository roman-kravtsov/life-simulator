import { useSyncExternalStore } from "react";
import { LifeScreen } from "./LifeScreen";
import { StartScreen } from "./StartScreen";
import type { GameStore } from "./store";

export function App({ store }: { store: GameStore }) {
  const { screen, life } = useSyncExternalStore(store.subscribe, store.getSnapshot);

  if (screen === "life" && life) {
    // Keyed by age so each year mounts fresh and focus returns to the heading.
    return <LifeScreen key={life.person.age} life={life} onContinue={store.continueYear} onBack={store.backToStart} />;
  }
  return <StartScreen onBegin={store.begin} />;
}
