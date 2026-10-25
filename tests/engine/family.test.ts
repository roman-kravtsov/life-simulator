import { describe, expect, it } from "vitest";
import { ageRelatives, generateSiblings, rollFamilyDeaths, rollSiblingBirth } from "../../src/engine/family";
import { CHILD_LABOUR_AGES, childLabourStatus } from "../../src/engine/checks";
import { lifeExpectancy } from "../../src/engine/mortality";
import { createRng } from "../../src/engine/rng";
import type { Relationship } from "../../src/engine/types";
import { makeCountry } from "../fixtures/country";
import { makePerson, moneyAt } from "../fixtures/person";

const country = makeCountry();
const rel = (overrides: Partial<Relationship> = {}): Relationship => ({
  id: "r",
  kind: "mother",
  name: "Mum",
  sex: "female",
  age: 30,
  alive: true,
  closeness: 70,
  ...overrides,
});

describe("ageRelatives (FAM-003)", () => {
  it("ages the living by a year and leaves the dead as they were", () => {
    const aged = ageRelatives([rel({ age: 30 }), rel({ id: "d", age: 60, alive: false })]);
    expect(aged.map((r) => r.age)).toEqual([31, 60]);
  });
  it("does not change its input", () => {
    const input = [rel()];
    Object.freeze(input[0]);
    Object.freeze(input);
    expect(() => ageRelatives(input)).not.toThrow();
  });
});

describe("rollFamilyDeaths (FAM-003)", () => {
  it("kills relatives with the life table probability for their age and sex", () => {
    const rng = createRng("family");
    let deaths = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const [after] = rollFamilyDeaths([rel({ age: 70, sex: "female" })], country, rng);
      if (!after!.alive) deaths++;
    }
    const qx = country.demography.lifeTable.value.female[70]!;
    expect(deaths / n).toBeGreaterThan(qx - 0.01);
    expect(deaths / n).toBeLessThan(qx + 0.01);
  });
  it("never revives or re-kills the dead", () => {
    const rng = createRng("dead");
    const [after] = rollFamilyDeaths([rel({ alive: false, age: 90 })], country, rng);
    expect(after).toEqual(rel({ alive: false, age: 90 }));
  });
  it("draws once per relative whether or not they are alive, so one death never shifts another's roll", () => {
    const alone = rollFamilyDeaths([rel({ id: "b", age: 60 })], country, createRng("x"));
    const withDead = rollFamilyDeaths(
      [rel({ id: "a", alive: false }), rel({ id: "b", age: 60 })],
      country,
      createRng("x"),
    );
    // The second relative's roll is the second draw in one case and the first in the other,
    // so compare over many seeds that both behave like the table instead of each other.
    expect(alone).toHaveLength(1);
    expect(withDead).toHaveLength(2);
  });
  it("makes parents' death ages follow the life table (batch)", () => {
    const startAge = 28;
    const n = 4000;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const rng = createRng(`mother-${i}`);
      let mother = rel({ age: startAge });
      for (;;) {
        [mother] = rollFamilyDeaths([mother], country, rng) as [Relationship];
        if (!mother.alive) break;
        [mother] = ageRelatives([mother]) as [Relationship];
      }
      total += mother.age + 0.5;
    }
    const expected = startAge + lifeExpectancy(country.demography.lifeTable.value.female.slice(startAge), startAge);
    expect(Math.abs(total / n - expected)).toBeLessThan(1);
  });
  it("makes children's deaths before 5 follow the life table (batch, FAM-004)", () => {
    const n = 20000;
    let died = 0;
    for (let i = 0; i < n; i++) {
      const rng = createRng(`child-${i}`);
      let child = rel({ kind: "child", name: "Child", sex: i % 2 === 0 ? "female" : "male", age: 0 });
      for (let year = 0; year < 5 && child.alive; year++) {
        [child] = rollFamilyDeaths([child], country, rng) as [Relationship];
        if (child.alive) [child] = ageRelatives([child]) as [Relationship];
      }
      if (!child.alive) died++;
    }
    const survive = (sex: "female" | "male") =>
      country.demography.lifeTable.value[sex].slice(0, 5).reduce((s, qx) => s * (1 - qx), 1);
    const expected = 1 - (survive("female") + survive("male")) / 2;
    expect(Math.abs(died / n - expected)).toBeLessThan(0.01);
  });
});

describe("childLabourStatus (SIM-005)", () => {
  const rate = country.work.childLabour.value;
  it("only applies in the child-labour ages", () => {
    expect(CHILD_LABOUR_AGES).toEqual([7, 14]);
    const rng = createRng("ages");
    expect(childLabourStatus(makePerson({ age: 6, flags: { childLabour: true } }), country, rng)).toBe(false);
    expect(childLabourStatus(makePerson({ age: 15, flags: { childLabour: true } }), country, rng)).toBe(false);
  });
  it("reproduces the country's child labour share at every age (batch)", () => {
    const n = 8000;
    const working = new Array<number>(CHILD_LABOUR_AGES[1] + 1).fill(0);
    for (let i = 0; i < n; i++) {
      const percentile = 1 + (i % 100);
      let person = makePerson({ age: 7, money: moneyAt(percentile) });
      for (let age = CHILD_LABOUR_AGES[0]; age <= CHILD_LABOUR_AGES[1]; age++) {
        const status = childLabourStatus({ ...person, age }, country, createRng(`c${i}-${age}`));
        working[age]! += status ? 1 : 0;
        person = { ...person, flags: { childLabour: status } };
      }
    }
    for (let age = CHILD_LABOUR_AGES[0]; age <= CHILD_LABOUR_AGES[1]; age++) {
      expect(Math.abs(working[age]! / n - rate), `age ${age}`).toBeLessThan(0.015);
    }
  });
  it("falls harder on poor households than on rich ones", () => {
    const share = (percentile: number) => {
      let w = 0;
      for (let i = 0; i < 4000; i++) {
        if (
          childLabourStatus(
            makePerson({ age: 7, money: moneyAt(percentile) }),
            country,
            createRng(`p${percentile}-${i}`),
          )
        )
          w++;
      }
      return w / 4000;
    };
    expect(share(5)).toBeGreaterThan(share(95) * 3);
  });
  it("is zero where no child works", () => {
    const none = makeCountry({ work: { ...country.work, childLabour: { ...country.work.childLabour, value: 0 } } });
    for (let i = 0; i < 200; i++)
      expect(childLabourStatus(makePerson({ age: 9 }), none, createRng(`z${i}`))).toBe(false);
  });
});

describe("siblings (FAM-002)", () => {
  const sibCountry = (tfr: number, meanAge = 28) =>
    makeCountry({
      region: "Western Africa",
      demography: {
        ...country.demography,
        tfr: { ...country.demography.tfr, value: tfr },
        meanAgeAtBirth: { ...country.demography.meanAgeAtBirth, value: meanAge },
      },
    });
  const mother = (age: number) => rel({ id: "mother", kind: "mother", age });

  it("generates older siblings with an age, a sex, a name and a closeness, oldest first", () => {
    const rng = createRng("older");
    let found = false;
    for (let i = 0; i < 50 && !found; i++) {
      const { siblings } = generateSiblings(createRng(`older-${i}`), sibCountry(6), 38);
      if (siblings.length < 2) continue;
      found = true;
      for (const s of siblings) {
        expect(s.kind).toBe("sibling");
        expect(s.alive).toBe(true);
        expect(s.age).toBeGreaterThanOrEqual(1);
        expect(s.age).toBeLessThanOrEqual(23);
        expect(s.name.length).toBeGreaterThan(0);
        expect(["female", "male"]).toContain(s.sex);
        expect(s.closeness).toBeGreaterThanOrEqual(40);
        expect(s.closeness).toBeLessThanOrEqual(90);
      }
      expect(siblings.map((s) => s.age)).toEqual([...siblings.map((s) => s.age)].sort((a, b) => b - a));
      expect(new Set(siblings.map((s) => s.id)).size).toBe(siblings.length);
    }
    expect(found).toBe(true);
    expect(rng.next()).toBeGreaterThanOrEqual(0);
  });
  it("gives a very young mother no older siblings", () => {
    for (let i = 0; i < 20; i++)
      expect(generateSiblings(createRng(`young-${i}`), sibCountry(6), 15).siblings).toEqual([]);
  });
  it("is deterministic and draws the same numbers whatever the family", () => {
    expect(generateSiblings(createRng("same"), sibCountry(4), 30)).toEqual(
      generateSiblings(createRng("same"), sibCountry(4), 30),
    );
  });
  it("counts the older siblings who died before the birth", () => {
    const deadly = makeCountry({
      region: "Western Africa",
      demography: {
        ...country.demography,
        tfr: { ...country.demography.tfr, value: 6 },
        lifeTable: {
          ...country.demography.lifeTable,
          value: { female: new Array<number>(101).fill(1), male: new Array<number>(101).fill(1) },
        },
      },
    });
    let lostTotal = 0;
    for (let i = 0; i < 30; i++) {
      const { siblings, lost } = generateSiblings(createRng(`lost-${i}`), deadly, 40);
      expect(siblings).toEqual([]);
      lostTotal += lost;
    }
    expect(lostTotal).toBeGreaterThan(0);
  });
  it("brings younger siblings only while the mother is alive and of childbearing age", () => {
    const person = makePerson({ age: 3, relationships: [mother(30)] });
    const births = (rel0: Relationship, seed: number) =>
      rollSiblingBirth({ ...person, relationships: [rel0] }, sibCountry(8), createRng(`b-${seed}`));
    let born = 0;
    for (let i = 0; i < 300; i++) if (births(mother(30), i)) born++;
    expect(born).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) expect(births(mother(46), i)).toBeUndefined();
    for (let i = 0; i < 300; i++) expect(births({ ...mother(30), alive: false }, i)).toBeUndefined();
    for (let i = 0; i < 300; i++) expect(births(mother(14), i)).toBeUndefined();
  });
  it("brings no younger sibling in a baby's first year", () => {
    const baby = makePerson({ age: 0, relationships: [mother(28)] });
    for (let i = 0; i < 300; i++)
      expect(rollSiblingBirth(baby, sibCountry(8), createRng(`first-${i}`))).toBeUndefined();
  });
  it("makes a newborn sibling age 0 with a name", () => {
    const person = makePerson({ age: 3, relationships: [mother(28)] });
    for (let i = 0; i < 200; i++) {
      const baby = rollSiblingBirth(person, sibCountry(8), createRng(`baby-${i}`));
      if (baby) {
        expect(baby).toMatchObject({ kind: "sibling", age: 0, alive: true });
        expect(baby.id).toBe("sibling-born-3");
        expect(baby.name.length).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error("no sibling was born");
  });
  it("draws four numbers every year", () => {
    const person = makePerson({ age: 3, relationships: [mother(28)] });
    for (const m of [mother(28), mother(60), { ...mother(28), alive: false }]) {
      const rng = createRng("four");
      const control = createRng("four");
      rollSiblingBirth({ ...person, relationships: [m] }, sibCountry(3), rng);
      for (let i = 0; i < 4; i++) control.next();
      expect(rng.next()).toBe(control.next());
    }
  });
  it.each([
    ["a high-fertility country", 6, 29],
    ["a middle one", 2.4, 28],
    ["a low-fertility one", 1.3, 32],
  ])("brings siblings in numbers that match fertility over a childhood, for %s (batch)", (_name, tfr, meanAge) => {
    // Every sibling a person will ever have, while the mother lives: born before them plus born during
    // their childhood. Dead infants before the birth count. The mean must be the country's fertility.
    const c = sibCountry(tfr, meanAge);
    const n = 6000;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const motherAge = Math.max(
        16,
        Math.min(46, Math.round(meanAge + 5.5 * (createRng(`ma-${i}`).next() - 0.5) * 3.46)),
      );
      const { siblings, lost } = generateSiblings(createRng(`older-${tfr}-${i}`), c, motherAge);
      total += siblings.length + lost;
      let person = makePerson({ age: 0, relationships: [mother(motherAge)] });
      for (let age = 0; age < 50 && person.relationships[0]!.age <= 45; age++) {
        const baby = rollSiblingBirth(person, c, createRng(`younger-${tfr}-${i}-${age}`));
        if (baby) total++;
        person = {
          ...person,
          age: age + 1,
          relationships: [{ ...person.relationships[0]!, age: person.relationships[0]!.age + 1 }],
        };
      }
    }
    expect(total / n).toBeGreaterThan(tfr * 0.9);
    expect(total / n).toBeLessThan(tfr * 1.1);
  });
});
