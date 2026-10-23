// Bridges the pure engine to React (useSyncExternalStore). The engine stays
// framework-free; React only reads snapshots and calls these actions.
import { advance, newLife } from "../engine/life";
import type { LifeState } from "../engine/types";

export type Screen = "start" | "life";

export interface GameSnapshot {
  screen: Screen;
  life: LifeState | null;
}

export interface GameStore {
  getSnapshot(): GameSnapshot;
  subscribe(listener: () => void): () => void;
  begin(): void;
  continueYear(): void;
  backToStart(): void;
}

export function createGameStore(makeSeed: () => string): GameStore {
  let snapshot: GameSnapshot = { screen: "start", life: null };
  const listeners = new Set<() => void>();

  const set = (next: GameSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    begin() {
      // Preview only: the real birth (country, sex, name, family) arrives in M3.
      set({ screen: "life", life: newLife({ seed: makeSeed(), sex: "female", name: "You" }) });
    },
    continueYear() {
      if (!snapshot.life) return;
      set({ screen: "life", life: advance(snapshot.life, { kind: "continue" }).state });
    },
    backToStart() {
      set({ screen: "start", life: null });
    },
  };
}

/** Seeds for new lives come from the browser, outside the engine. */
export const browserSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36);
