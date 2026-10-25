import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decisionCard, advance, newLife, withEpitaph, withSettings } from "../../src/engine/life";
import { resolvePlan, FOCUS_AREAS, emptyPlan, PLAN_START_AGE } from "../../src/engine/focus";
import { createRng, type Rng } from "../../src/engine/rng";
import { ReplayError, replay } from "../../src/engine/replay";
import { toSave } from "../../src/engine/save";
import type { LifeState, Plan } from "../../src/engine/types";
import type { Country } from "../../src/engine/world/types";
import { makeCountry } from "../fixtures/country";

const load = (iso3: string) => JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;

/** A valid plan that puts the player's points in random places. */
function randomPlan(state: LifeState, rng: Rng): Plan {
  const view = resolvePlan(state.person, state.plan);
  const open = FOCUS_AREAS.filter((area) => !view.locked[area]);
  const plan = emptyPlan();
  for (let i = 0; i < view.free; i++) plan[open[rng.int(0, open.length - 1)]!]++;
  return plan;
}

/**
 * A player who sets plans, changes settings, and answers decisions at random, all from one seeded
 * stream so the same behaviour is played again. Stops after `years` recorded years, or at death.
 */
function play(seed: string, country: Country, behaviour: string, years = Infinity, stopAtDecision = false): LifeState {
  const rng = createRng(behaviour);
  let state = newLife({
    seed,
    country,
    settings: { pace: rng.chance(0.5) ? "quiet-years" : "every-year", softening: rng.chance(0.3) },
  });
  while (state.person.alive) {
    if (state.history.length >= years && (state.turn || !stopAtDecision)) break;
    if (rng.chance(0.04)) state = withSettings(state, { softening: !state.settings.softening });
    if (rng.chance(0.03))
      state = withSettings(state, { pace: state.settings.pace === "quiet-years" ? "every-year" : "quiet-years" });
    if (state.turn) {
      const open = decisionCard(state, country)!.choices.filter((c) => !c.lockedReason);
      state = advance(state, { kind: "choose", choiceId: open[rng.int(0, open.length - 1)]!.id }, country).state;
      continue;
    }
    const plan = state.person.age >= PLAN_START_AGE && rng.chance(0.25) ? randomPlan(state, rng) : undefined;
    state = advance(state, { kind: "continue", ...(plan ? { plan } : {}) }, country).state;
  }
  return state;
}

const versions = { dataVersion: "test-data", contentVersion: "test-content", now: "2026-10-25T00:00:00.000Z" };

describe("RNG-004: replaying a life from its seed and logs", () => {
  const nigeria = load("NGA");
  const japan = load("JPN");
  const india = load("IND");

  it("gives identical full histories for many lives played at random", () => {
    const countries = [nigeria, japan, india, makeCountry({ region: "Western Africa" })];
    let decisions = 0;
    let plans = 0;
    let settings = 0;
    for (let i = 0; i < 24; i++) {
      const country = countries[i % countries.length]!;
      const life = play(`replay-${i}`, country, `player-${i}`);
      decisions += life.decisions.length;
      plans += life.planLog?.length ?? 0;
      settings += life.settingsLog?.length ?? 0;
      expect(replay(toSave(life, versions), country)).toEqual(life);
    }
    // The test only means something when lives had choices, plans and changes of settings to replay.
    expect(decisions).toBeGreaterThan(20);
    expect(plans).toBeGreaterThan(20);
    expect(settings).toBeGreaterThan(10);
  });

  it("replays a life that is still going, up to the year it had reached, with a decision waiting or not", () => {
    let waiting = 0;
    for (let i = 0; i < 20; i++) {
      const life = play(`partial-${i}`, nigeria, `partial-player-${i}`, 10 + i * 2, i % 2 === 0);
      if (life.turn) waiting++;
      expect(replay(toSave(life, versions), nigeria)).toEqual(life);
    }
    expect(waiting).toBeGreaterThan(0);
  });

  it("replays a life stopped at every step of its first years", () => {
    for (let years = 0; years < 25; years++) {
      const life = play("stepwise", india, "stepwise-player", years);
      expect(replay(toSave(life, versions), india)).toEqual(life);
    }
  });

  it("does not need the epitaph, and keeps it when there is one", () => {
    const life = play("epitaph-replay", japan, "epitaph-player");
    const written = withEpitaph(life, "Kept bees");
    expect(replay(toSave(written, versions), japan)).toEqual(life);
  });

  it("gives another life for another seed, or for another plan", () => {
    const a = play("other-a", nigeria, "same-player");
    const b = play("other-b", nigeria, "same-player");
    expect(replay(toSave(a, versions), nigeria)).not.toEqual(b);
    const save = toSave(a, versions);
    const changed = { ...save, planLog: [{ age: 10, plan: { ...emptyPlan(), rest: 3 } }, ...save.planLog.slice(1)] };
    // A different plan either gives a different life, or one whose logged decisions no longer fit.
    const other = (() => {
      try {
        return replay(changed, nigeria);
      } catch (error) {
        return error;
      }
    })();
    expect(other).not.toEqual(a);
  });

  it("is a ReplayError, not a wrong life, when a logged decision does not fit", () => {
    let life = play("broken", nigeria, "broken-player");
    for (let i = 0; i < 30 && life.decisions.length === 0; i++)
      life = play(`broken-${i}`, nigeria, `broken-player-${i}`);
    const save = toSave(life, versions);
    const wrong = { ...save, decisions: save.decisions.map((d) => ({ ...d, choiceId: "not-a-choice" })) };
    expect(() => replay(wrong, nigeria)).toThrow(ReplayError);
    const missing = { ...save, decisions: save.decisions.slice(1) };
    expect(() => replay(missing, nigeria)).toThrow(ReplayError);
  });
});
