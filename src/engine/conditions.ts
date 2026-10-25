// The condition language for events (EVENT-002, design 2.3).
import type { Location, Person, Sector, Sex, StatId, TraitId } from "./types";
import type { Country } from "./world/types";

export type Condition =
  | { stat: StatId; op: "<" | ">"; value: number }
  | { stat: StatId; op: "between"; value: [number, number] }
  | { trait: TraitId; op: "<" | ">"; value: number }
  | { flag: string; is: boolean | number }
  | { world: string; op: "<" | ">"; value: number }
  | { has: "partner" | "child" | "job" | "savings" }
  | { age: [number, number] }
  | { location: Location }
  /** Where the person stands among their countrymen (1 to 100): the household's for a child, their own as an adult. */
  | { standing: "<" | ">"; value: number }
  | { school: boolean }
  /** At work in this sector. */
  | { sector: Sector };

export interface ConditionContext {
  person: Person;
  country: Country;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isSourced = (value: unknown): value is { value: unknown; source: string; year: number; estimated?: boolean } =>
  isObject(value) && "value" in value && "source" in value && "year" in value;

export interface SourcedIndicator {
  value: number;
  source: string;
  year: number;
  /** True when the country has no value and this one is a regional or income-group average. */
  estimated?: boolean;
}

/**
 * Reads a dotted path in the country data, such as "work.unemployment". Sourced values are
 * unwrapped, and a value split by sex is read for `sex`. Returns the source and year as well,
 * for the "here, about N in 100..." note. Throws for a path that does not lead to a number.
 */
export function readIndicator(country: Country, path: string, sex: Sex): SourcedIndicator {
  let node: unknown = country;
  let sourced: { source: string; year: number; estimated?: boolean } | undefined;
  for (const segment of path.split(".")) {
    if (isSourced(node) && !(segment in node)) {
      sourced = { source: node.source, year: node.year, ...(node.estimated ? { estimated: true } : {}) };
      node = node.value;
    }
    if (!isObject(node) || !(segment in node)) throw new Error(`Unknown indicator: ${path}`);
    node = node[segment];
  }
  if (isSourced(node)) {
    sourced = { source: node.source, year: node.year, ...(node.estimated ? { estimated: true } : {}) };
    node = node.value;
  }
  if (isObject(node) && sex in node) node = node[sex];
  if (typeof node !== "number" || !sourced) throw new Error(`Indicator is not a sourced number: ${path}`);
  return { value: node, ...sourced };
}

export const indicatorValue = (country: Country, path: string, sex: Sex) => readIndicator(country, path, sex).value;

export function holds(condition: Condition, { person, country }: ConditionContext): boolean {
  if ("stat" in condition) {
    const value = person.stats[condition.stat];
    if (condition.op === "between") return value >= condition.value[0] && value <= condition.value[1];
    return condition.op === "<" ? value < condition.value : value > condition.value;
  }
  if ("trait" in condition) {
    const value = person.traits[condition.trait];
    return condition.op === "<" ? value < condition.value : value > condition.value;
  }
  if ("flag" in condition) return (person.flags[condition.flag] ?? false) === condition.is;
  if ("world" in condition) {
    const value = indicatorValue(country, condition.world, person.sex);
    return condition.op === "<" ? value < condition.value : value > condition.value;
  }
  if ("has" in condition) {
    switch (condition.has) {
      case "partner":
        return person.relationships.some((r) => r.alive && (r.kind === "partner" || r.kind === "spouse"));
      case "child":
        return person.relationships.some((r) => r.alive && r.kind === "child");
      case "job":
        return person.work.status === "employed" || person.work.status === "informal";
      case "savings":
        return person.money.savings > 0;
    }
  }
  if ("age" in condition) return person.age >= condition.age[0] && person.age <= condition.age[1];
  if ("standing" in condition) {
    return condition.standing === "<"
      ? person.money.percentile < condition.value
      : person.money.percentile > condition.value;
  }
  if ("school" in condition) return person.education.inSchool === condition.school;
  if ("sector" in condition) {
    const working = person.work.status === "employed" || person.work.status === "informal";
    return working && person.work.sector === condition.sector;
  }
  return person.location === condition.location;
}

/** True when there are no conditions or every one holds. */
export const allHold = (conditions: readonly Condition[] | undefined, ctx: ConditionContext) =>
  (conditions ?? []).every((c) => holds(c, ctx));
