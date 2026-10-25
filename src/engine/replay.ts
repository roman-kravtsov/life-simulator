// Replaying a life from its seed and the player's logs (RNG-004, SAVE-005, design 2.4 and 3.9): the same seed,
// data and content versions and the same decision, plan and settings logs always give the same life.
import { catalog as contentCatalog } from "../content/events";
import { advance, newLife } from "./life";
import type { EventCatalog } from "./events";
import type { DecisionLogEntry, LifeState, PlanLogEntry, Settings, SettingsLogEntry } from "./types";
import type { Country } from "./world/types";

/** What a replay needs: the real save, of which the snapshot is only a cache. */
export interface ReplayInput {
  seed: string;
  /** The settings the life began with. */
  settings: Settings;
  decisions: readonly DecisionLogEntry[];
  settingsLog: readonly SettingsLogEntry[];
  planLog: readonly PlanLogEntry[];
  /** How many years the life had recorded. */
  years: number;
  /** Whether the next year was waiting on a decision when the life was saved. */
  waiting?: boolean;
}

/** The logs do not fit the seed, the data or the content: the life cannot be rebuilt. */
export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayError";
  }
}

/** The life the logs describe, lived again year by year. Throws a `ReplayError` when they do not fit. */
export function replay(input: ReplayInput, country: Country, catalog: EventCatalog = contentCatalog): LifeState {
  let state = newLife({ seed: input.seed, country, settings: input.settings });
  const plans = new Map(input.planLog.map((entry) => [entry.age, entry.plan]));
  let nextSetting = 0;
  let nextDecision = 0;

  /** A change of settings made at an age applies from the next year lived at or after it. */
  const applySettings = (upTo: number) => {
    while (nextSetting < input.settingsLog.length && input.settingsLog[nextSetting]!.age <= upTo) {
      const entry = input.settingsLog[nextSetting++]!;
      state = {
        ...state,
        settings: { ...state.settings, ...entry.changes },
        settingsLog: [...(state.settingsLog ?? []), entry],
      };
    }
  };

  const limit = 10 * (input.years + 10);
  const waiting = input.waiting === true;
  // A year waiting on a decision is not in the history yet, so it takes one more step to reach it.
  const done = () => state.history.length >= input.years && (!waiting || state.turn !== undefined);
  for (let step = 0; state.person.alive && !done(); step++) {
    if (step > limit) throw new ReplayError("The life did not reach the year the save says it had");
    try {
      if (state.turn) {
        const entry = input.decisions[nextDecision++];
        if (!entry || entry.year !== state.turn.year || entry.eventId !== state.turn.decision.eventId) {
          throw new ReplayError(
            `No logged answer for the decision "${state.turn.decision.eventId}" at ${state.turn.year}`,
          );
        }
        state = advance(state, { kind: "choose", choiceId: entry.choiceId }, country, catalog).state;
      } else {
        applySettings(state.person.age);
        const plan = plans.get(state.person.age);
        state = advance(state, { kind: "continue", ...(plan ? { plan } : {}) }, country, catalog).state;
      }
    } catch (error) {
      if (error instanceof ReplayError) throw error;
      throw new ReplayError(error instanceof Error ? error.message : String(error));
    }
  }
  // Whatever was changed after the last step: while a decision waited, or between years.
  applySettings(Infinity);
  if (state.history.length !== input.years) {
    throw new ReplayError(`The save says ${input.years} years, the replay has ${state.history.length}`);
  }
  if (waiting !== (state.turn !== undefined)) {
    throw new ReplayError(
      waiting ? "The decision the save was waiting on never came" : "A decision came that was not saved",
    );
  }
  if (nextDecision !== input.decisions.length) throw new ReplayError("Some logged decisions were never asked");
  return state;
}
