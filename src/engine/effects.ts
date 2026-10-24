import type {
  Cause,
  CauseId,
  HealthCondition,
  LifeState,
  Person,
  Relationship,
  RelationshipKind,
  StatId,
} from "./types";

// Effects change a life (design 2.3). Each applied effect keeps its cause tag.
// Stat, flag, relationship and condition effects exist now; money and the rest are added with
// their systems.
export type Effect =
  | { stat: StatId; add: number }
  | { set: string; value: number | boolean }
  | { relationship: "add"; relative: Relationship }
  | { relationship: "remove"; id: string }
  /** Moves closeness for one relative (`id`), or every living relative of a `kind`, or all of them. */
  | { relationship: "closeness"; amount: number; id?: string; kind?: RelationshipKind }
  /** A condition begins, or gets the new severity if the person has it already. */
  | { condition: "add"; id: string; severity: HealthCondition["severity"]; raises?: CauseId }
  | { condition: "remove"; id: string };

export interface AppliedEffect {
  effect: Effect;
  cause: Cause;
  /** The change actually applied, after clamping. Only for stat effects. */
  delta?: number;
}

export const clampStat = (value: number) => Math.min(100, Math.max(0, value));

function addCondition(person: Person, effect: Extract<Effect, { condition: "add" }>): HealthCondition[] {
  const existing = person.conditions.find((c) => c.id === effect.id);
  if (existing) return person.conditions.map((c) => (c === existing ? { ...c, severity: effect.severity } : c));
  const added: HealthCondition = { id: effect.id, severity: effect.severity, since: person.age };
  if (effect.raises) added.raises = effect.raises;
  return [...person.conditions, added];
}

export function applyEffectsToPerson(
  person: Person,
  effects: readonly Effect[],
  cause: Cause,
): { person: Person; applied: AppliedEffect[] } {
  const stats = { ...person.stats };
  const flags = { ...person.flags };
  let relationships = person.relationships;
  let conditions = person.conditions;
  const applied: AppliedEffect[] = [];
  for (const effect of effects) {
    if ("stat" in effect) {
      const before = stats[effect.stat];
      const after = clampStat(before + effect.add);
      stats[effect.stat] = after;
      applied.push({ effect, cause, delta: after - before });
    } else if ("set" in effect) {
      flags[effect.set] = effect.value;
      applied.push({ effect, cause });
    } else if ("relationship" in effect) {
      if (effect.relationship === "add") {
        if (!relationships.some((r) => r.id === effect.relative.id))
          relationships = [...relationships, effect.relative];
      } else if (effect.relationship === "remove") {
        relationships = relationships.filter((r) => r.id !== effect.id);
      } else {
        relationships = relationships.map((r) =>
          r.alive &&
          (effect.id === undefined || r.id === effect.id) &&
          (effect.kind === undefined || r.kind === effect.kind)
            ? { ...r, closeness: clampStat(r.closeness + effect.amount) }
            : r,
        );
      }
      applied.push({ effect, cause });
    } else {
      conditions =
        effect.condition === "add"
          ? addCondition({ ...person, conditions }, effect)
          : conditions.filter((c) => c.id !== effect.id);
      applied.push({ effect, cause });
    }
  }
  return { person: { ...person, stats, flags, relationships, conditions }, applied };
}

export function applyEffects(
  state: LifeState,
  effects: readonly Effect[],
  cause: Cause,
): { state: LifeState; applied: AppliedEffect[] } {
  const { person, applied } = applyEffectsToPerson(state.person, effects, cause);
  return { state: { ...state, person }, applied };
}
