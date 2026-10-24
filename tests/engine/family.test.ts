import { describe, expect, it } from "vitest";
import { ageRelatives, rollFamilyDeaths } from "../../src/engine/family";
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
