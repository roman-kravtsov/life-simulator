import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { namesForRegion } from "../../src/content/names";
import { advance, advanceAuto, newLife } from "../../src/engine/life";
import { pickName, reservedNames, takenNames } from "../../src/engine/names";
import type { Person, Relationship } from "../../src/engine/types";
import type { Country } from "../../src/engine/world/types";

const real = (iso3: string) => JSON.parse(readFileSync(`public/data/countries/${iso3}.json`, "utf8")) as Country;

const key = (name: string) => name.toLocaleLowerCase();

/** The names that must all differ: the person's own and every living relative's. */
const livingNames = (person: Person, extra: readonly Relationship[] = []): string[] => [
  person.name,
  ...[...person.relationships, ...extra].filter((r) => r.alive).map((r) => r.name),
];

const duplicates = (names: readonly string[]): string[] => {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const name of names) {
    if (seen.has(key(name))) dupes.push(name);
    seen.add(key(name));
  }
  return dupes;
};

describe("pickName (CHAR-007)", () => {
  const list = ["Ada", "Bea", "Cy", "Di"];
  it("takes the name the roll points at when it is free", () => {
    expect(pickName(list, 0, new Set())).toBe("Ada");
    expect(pickName(list, 0.6, new Set())).toBe("Cy");
    expect(pickName(list, 0.999, new Set())).toBe("Di");
  });
  it("moves on to the next free name when it is taken, wrapping at the end", () => {
    expect(pickName(list, 0, new Set(["ada"]))).toBe("Bea");
    expect(pickName(list, 0.99, new Set(["di", "ada"]))).toBe("Bea");
  });
  it("ignores case when it compares", () => {
    expect(pickName(list, 0, new Set([key("ADA")]))).toBe("Bea");
  });
  it("still returns a name when the whole list is taken", () => {
    expect(pickName(list, 0.3, new Set(list.map(key)))).toBe("Bea");
  });
  it("collects the names of the living relatives and the person, and of relatives about to be added", () => {
    const person = newLife({ seed: "taken-names", country: real("NGA") }).person;
    const dead: Relationship = { ...person.relationships[0]!, alive: false, name: "Departed" };
    const taken = takenNames({ ...person, relationships: [...person.relationships, dead] }, ["Pending"]);
    expect(taken.has(key(person.name))).toBe(true);
    expect(taken.has(key(person.relationships[0]!.name))).toBe(true);
    expect(taken.has("pending")).toBe(true);
    expect(taken.has("departed")).toBe(false);
  });
  it("reads the names of the relatives that a year's events add", () => {
    const friend: Relationship = {
      id: "f",
      kind: "friend",
      name: "Zed",
      sex: "male",
      age: 9,
      alive: true,
      closeness: 40,
    };
    const events = [
      { id: "a", textKey: "x", cause: "chance", effects: [{ stat: "health", add: 1 }] },
      { id: "b", textKey: "x", cause: "chance", effects: [{ relationship: "add", relative: friend }] },
    ] as Parameters<typeof reservedNames>[0];
    expect(reservedNames(events)).toEqual(["Zed"]);
  });
});

describe("distinct names across a life (CHAR-007)", () => {
  // One country for most name groups, so every list is used.
  const ISO = ["NGA", "KEN", "EGY", "IND", "JPN", "IDN", "DEU", "BRA", "POL", "AUS", "KAZ", "ZAF"];
  const LIVES = 25;

  it("the newborn, parents and older siblings never share a name", () => {
    for (const iso3 of ISO) {
      const country = real(iso3);
      for (let i = 0; i < 300; i++) {
        const { person } = newLife({ seed: `birth-names-${i}`, country });
        expect(duplicates(livingNames(person)), `${iso3} ${i}`).toEqual([]);
      }
    }
  });

  it.each(ISO)(
    "no living relatives share a name, or the person's, in any year of %s lives",
    (iso3) => {
      const country = real(iso3);
      const found: string[] = [];
      for (let i = 0; i < LIVES; i++) {
        let state = newLife({ seed: `distinct-${iso3}-${i}`, country, settings: { pace: "every-year" } });
        while (state.person.alive) {
          const first = advance(state, { kind: "continue" }, country).state;
          if (first.turn) {
            // A question waits: the person met, and the relatives the year has added, must be new names too.
            const added = first.turn.pending.flatMap((p) =>
              p.effects.flatMap((e) => ("relationship" in e && e.relationship === "add" ? [e.relative] : [])),
            );
            const met = first.turn.decision.payload?.relative;
            const dupes = duplicates(livingNames(first.turn.person, [...added, ...(met ? [met] : [])]));
            if (dupes.length) found.push(`${iso3} ${i} age ${first.turn.year} (asked): ${dupes.join(", ")}`);
            state = advanceAuto(state, country);
          } else state = first;
          const dupes = duplicates(livingNames(state.person));
          if (dupes.length) found.push(`${iso3} ${i} age ${state.person.age}: ${dupes.join(", ")}`);
        }
      }
      expect(found).toEqual([]);
    },
    120_000,
  );

  it("keeps every name inside the region's list", () => {
    const country = real("JPN");
    const pool = new Set([...namesForRegion(country.region).female, ...namesForRegion(country.region).male]);
    let state = newLife({ seed: "in-list", country, settings: { pace: "every-year" } });
    while (state.person.alive) state = advanceAuto(state, country);
    for (const r of state.person.relationships) expect(pool.has(r.name), r.name).toBe(true);
  });
});
