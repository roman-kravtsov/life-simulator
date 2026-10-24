import { describe, expect, it } from "vitest";
import { closenessNorm, driftCloseness } from "../../src/engine/relationships";
import { createRng } from "../../src/engine/rng";
import type { Person, Relationship } from "../../src/engine/types";
import { makePerson } from "../fixtures/person";

const rel = (overrides: Partial<Relationship> = {}): Relationship => ({
  id: "r",
  kind: "mother",
  name: "Mum",
  sex: "female",
  age: 40,
  alive: true,
  closeness: 60,
  ...overrides,
});
const person = (age = 30, overrides: Partial<Person> = {}) => makePerson({ age, ...overrides });
const withSociability = (value: number) => ({
  traits: { temperament: 0, curiosity: 0, resilience: 0, sociability: value, aptitude: 0, constitution: 0 },
});

describe("closeness norm (REL-001)", () => {
  it("is higher for a sociable person", () => {
    expect(closenessNorm(rel(), person(30, withSociability(2)))).toBeGreaterThan(
      closenessNorm(rel(), person(30, withSociability(-2))),
    );
  });
  it("dips for parents in the teenage years", () => {
    expect(closenessNorm(rel(), person(15))).toBeLessThan(closenessNorm(rel(), person(30)));
    expect(closenessNorm(rel({ kind: "sibling" }), person(15))).toBe(
      closenessNorm(rel({ kind: "sibling" }), person(30)),
    );
  });
  it("stays between 0 and 100 for every kind", () => {
    for (const kind of ["mother", "father", "sibling", "partner", "spouse", "child", "friend", "mentor"] as const) {
      for (const sociability of [-2, 2]) {
        const norm = closenessNorm(rel({ kind }), person(30, withSociability(sociability)));
        expect(norm).toBeGreaterThanOrEqual(0);
        expect(norm).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("driftCloseness (REL-001)", () => {
  const drift = (relatives: Relationship[], p = person(), seed = "d") => driftCloseness(relatives, p, createRng(seed));
  it("moves closeness toward the norm from above and from below", () => {
    const norm = closenessNorm(rel(), person());
    const [high] = drift([rel({ closeness: 100 })]);
    const [low] = drift([rel({ closeness: 0 })]);
    expect(high!.closeness).toBeLessThan(100);
    expect(high!.closeness).toBeGreaterThan(norm - 5);
    expect(low!.closeness).toBeGreaterThan(0);
    expect(low!.closeness).toBeLessThan(norm);
  });
  it("keeps closeness between 0 and 100", () => {
    for (let i = 0; i < 50; i++) {
      for (const closeness of [0, 100]) {
        const [r] = drift([rel({ closeness })], person(), `s${i}`);
        expect(r!.closeness).toBeGreaterThanOrEqual(0);
        expect(r!.closeness).toBeLessThanOrEqual(100);
      }
    }
  });
  it("leaves the dead as they were", () => {
    const dead = rel({ alive: false, closeness: 88 });
    expect(drift([dead])[0]).toEqual(dead);
  });
  it("draws one number per relative, living or dead, so one death never shifts another's roll", () => {
    const rng = createRng("count");
    const control = createRng("count");
    driftCloseness([rel(), rel({ id: "b", alive: false }), rel({ id: "c" })], person(), rng);
    for (let i = 0; i < 3; i++) control.next();
    expect(rng.next()).toBe(control.next());
    const alive = driftCloseness([rel({ id: "a" }), rel({ id: "b" })], person(), createRng("same"));
    const oneDead = driftCloseness([rel({ id: "a", alive: false }), rel({ id: "b" })], person(), createRng("same"));
    expect(oneDead[1]).toEqual(alive[1]);
  });
  it("does not change its input", () => {
    const input = [rel()];
    Object.freeze(input[0]);
    Object.freeze(input);
    expect(() => drift(input)).not.toThrow();
  });
});
