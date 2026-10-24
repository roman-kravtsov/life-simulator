import type { LifeStage } from "./types";

// Lower age bound of each stage (design 3.1), oldest first for lookup.
const STAGES: readonly [number, LifeStage][] = [
  [65, "elder"],
  [50, "midlife"],
  [30, "adulthood"],
  [18, "youth"],
  [12, "adolescence"],
  [3, "childhood"],
  [0, "infancy"],
];

export function stageForAge(age: number): LifeStage {
  if (!Number.isInteger(age) || age < 0) throw new Error(`Invalid age: ${age}`);
  return STAGES.find(([min]) => age >= min)![1];
}
