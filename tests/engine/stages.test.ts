import { describe, expect, it } from "vitest";
import { stageForAge } from "../../src/engine/stages";

describe("stageForAge", () => {
  it.each([
    [0, "infancy"], [2, "infancy"],
    [3, "childhood"], [11, "childhood"],
    [12, "adolescence"], [17, "adolescence"],
    [18, "youth"], [29, "youth"],
    [30, "adulthood"], [49, "adulthood"],
    [50, "midlife"], [64, "midlife"],
    [65, "elder"], [110, "elder"],
  ] as const)("age %i is %s", (age, stage) => {
    expect(stageForAge(age)).toBe(stage);
  });

  it("rejects negative or fractional ages", () => {
    expect(() => stageForAge(-1)).toThrow();
    expect(() => stageForAge(2.5)).toThrow();
  });
});
