import type { Cause, LifeState, StatId } from "./types";

// Effects change a life (design 2.3). Each applied effect keeps its cause tag.
// Stat and flag effects exist now; money, relationships, conditions and the
// rest are added with their systems.
export type Effect = { stat: StatId; add: number } | { set: string; value: number | boolean };

export interface AppliedEffect {
  effect: Effect;
  cause: Cause;
  /** The change actually applied, after clamping. Only for stat effects. */
  delta?: number;
}

export const clampStat = (value: number) => Math.min(100, Math.max(0, value));

export function applyEffects(
  state: LifeState,
  effects: readonly Effect[],
  cause: Cause,
): { state: LifeState; applied: AppliedEffect[] } {
  const next = structuredClone(state);
  const applied: AppliedEffect[] = [];
  for (const effect of effects) {
    if ("stat" in effect) {
      const before = next.person.stats[effect.stat];
      const after = clampStat(before + effect.add);
      next.person.stats[effect.stat] = after;
      applied.push({ effect, cause, delta: after - before });
    } else {
      next.person.flags[effect.set] = effect.value;
      applied.push({ effect, cause });
    }
  }
  return { state: next, applied };
}
