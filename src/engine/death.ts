// The end of a life (DEATH-001 to DEATH-003): the record of the death, the closing passage and the
// age at death against the life expectancy of the person's country and sex.
import { lifeExpectancy } from "./mortality";
import { stageForAge } from "./stages";
import type { CauseId, LifeStage, LifeState, Sex } from "./types";
import type { Country } from "./world/types";

/** Causes of death that share a closing passage. About a dozen, so every death has a fitting one. */
export const DEATH_GROUPS = [
  "infection",
  "earlyLife",
  "childbirth",
  "hunger",
  "cancer",
  "heart",
  "lungs",
  "longIllness",
  "accident",
  "violence",
  "war",
  "selfHarm",
  "other",
] as const;

export type DeathGroup = (typeof DEATH_GROUPS)[number];

const GROUP_OF: Record<string, DeathGroup> = {
  infectious: "infection",
  respiratoryInfection: "infection",
  neonatal: "earlyLife",
  congenital: "earlyLife",
  maternal: "childbirth",
  nutritional: "hunger",
  cancer: "cancer",
  cardiovascular: "heart",
  chronicRespiratory: "lungs",
  diabetes: "longIllness",
  digestive: "longIllness",
  unintentionalInjury: "accident",
  violence: "violence",
  conflict: "war",
  selfHarm: "selfHarm",
};

export const deathGroup = (cause: CauseId): DeathGroup => GROUP_OF[cause] ?? "other";

/** A life counts as about as long as expected when it falls within this many years of the life expectancy. */
export const EXPECTANCY_SIMILAR_YEARS = 5;

export interface ExpectancyComparison {
  /** Life expectancy at birth for the person's sex, in years (UN WPP life table). */
  expected: number;
  /** Age at death less `expected`, in years. */
  difference: number;
  verdict: "shorter" | "similar" | "longer";
  /** The share (0 to 1) of people of this sex in the country who live to the age at death. */
  reached: number;
  source: string;
  year: number;
}

/** Where an age at death sits against the life table of the country (DEATH-003). */
export function compareWithExpectancy(sex: Sex, age: number, country: Country): ExpectancyComparison {
  const { value, source, year } = country.demography.lifeTable;
  const table = value[sex];
  const expected = lifeExpectancy(table);
  const difference = age - expected;
  let reached = 1;
  for (let a = 0; a < Math.min(age, table.length); a++) reached *= 1 - table[a]!;
  return {
    expected,
    difference,
    verdict:
      difference < -EXPECTANCY_SIMILAR_YEARS ? "shorter" : difference > EXPECTANCY_SIMILAR_YEARS ? "longer" : "similar",
    reached,
    source,
    year,
  };
}

/** Everything the end of the life needs to say about the death (DEATH-001). */
export interface DeathRecord {
  /** Completed years at death. */
  age: number;
  /** Calendar year of death, in the same world calendar as the year of birth. */
  year: number;
  cause: CauseId;
  group: DeathGroup;
  stage: LifeStage;
  /** String keys of the closing passage, in the softened telling when softening is on (DEATH-002), and the line after it. */
  passageKey: string;
  codaKey: string;
  expectancy: ExpectancyComparison;
}

export function deathRecord(life: LifeState, country: Country): DeathRecord {
  const { death, person, settings } = life;
  if (!death) throw new Error("This life has not ended");
  const group = deathGroup(death.cause);
  const stage = stageForAge(death.age);
  return {
    age: death.age,
    year: person.birthYear + death.age,
    cause: death.cause,
    group,
    stage,
    passageKey: `death.passage.${group}${settings.softening ? ".soft" : ""}`,
    codaKey: `death.coda.${stage}`,
    expectancy: compareWithExpectancy(person.sex, death.age, country),
  };
}
