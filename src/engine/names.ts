// Distinct names (CHAR-007): nobody in one life takes the name of the person or of a living relative.
import type { PendingEvent } from "./events";
import type { Person } from "./types";

const keyOf = (name: string) => name.toLocaleLowerCase();

/**
 * The name a roll points at in a list, or the next free one after it (wrapping) when that name is taken.
 * It uses the one roll the caller already drew, so a draw never shifts the stream and a name that was
 * free stays what it was. `taken` holds names as `takenNames` returns them. A list with no free name
 * gives the rolled one, which the lists of 40 or more never reach.
 */
export function pickName(list: readonly string[], roll: number, taken: ReadonlySet<string>): string {
  const start = Math.min(list.length - 1, Math.floor(roll * list.length));
  for (let i = 0; i < list.length; i++) {
    const name = list[(start + i) % list.length]!;
    if (!taken.has(keyOf(name))) return name;
  }
  return list[start]!;
}

/** The names no new person may take: the person's, every living relative's and any about to be added. */
export function takenNames(
  person: Pick<Person, "name" | "relationships">,
  reserved: Iterable<string> = [],
): Set<string> {
  const taken = new Set<string>([keyOf(person.name)]);
  for (const r of person.relationships) if (r.alive) taken.add(keyOf(r.name));
  for (const name of reserved) taken.add(keyOf(name));
  return taken;
}

/** The names of the relatives that a year's events add, which are not in the person's relationships until the year ends. */
export const reservedNames = (pending: readonly PendingEvent[]): string[] =>
  pending.flatMap((p) =>
    p.effects.flatMap((e) => ("relationship" in e && e.relationship === "add" ? [e.relative.name] : [])),
  );
