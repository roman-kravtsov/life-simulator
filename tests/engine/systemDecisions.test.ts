import { describe, expect, it } from "vitest";
import { conditionCatalog } from "../../src/content/healthConditions";
import { choiceViews, defaultChoiceId, outcomeProbabilities, resolveChoice } from "../../src/engine/decisions";
import {
  HIGHER_DECISION,
  LEAVE_DECISION,
  SCHOLARSHIP_MIN_SKILLS,
  scholarshipOdds,
  stayOdds,
  stepEducation,
} from "../../src/engine/education";
import { applyEffectsToPerson } from "../../src/engine/effects";
import {
  CARE_ASK_AGE,
  CARE_DECISION,
  careCost,
  careLevel,
  conditionOdds,
  stepConditions,
  type ConditionDef,
} from "../../src/engine/health";
import { SELF_HARM_CAUSE, SELF_HARM_FROM_AGE, drawCause } from "../../src/engine/mortality";
import { MEET_DECISION } from "../../src/engine/partnership";
import {
  FRIENDSHIP_ENDS_BELOW,
  ILL_RECOVERY,
  friendChance,
  illOnset,
  stepCare,
  stepFriends,
} from "../../src/engine/relationships";
import { createRng, stream, type Rng } from "../../src/engine/rng";
import { stageForAge } from "../../src/engine/stages";
import { stepMoney, tertiaryYearlyCost } from "../../src/engine/money";
import { systemDecision } from "../../src/engine/systemDecisions";
import type { Person, Relationship } from "../../src/engine/types";
import type { CauseMix } from "../../src/engine/world/types";
import { makeCountry } from "../fixtures/country";
import { makePerson, moneyAt } from "../fixtures/person";

const country = makeCountry({ region: "Western Africa" });
const at = (age: number, overrides: Partial<Person> = {}) => makePerson({ age, stage: stageForAge(age), ...overrides });
const always = (value: number): Rng => ({
  next: () => value,
  int: (min) => min,
  chance: (p) => value < p,
  weighted: (items) => items[0]!,
});
const relative = (overrides: Partial<Relationship> = {}): Relationship => ({
  id: "r1",
  kind: "mother",
  name: "Ama",
  sex: "female",
  age: 60,
  alive: true,
  closeness: 60,
  ...overrides,
});

const ctx = (person: Person, payload = {}) => ({ person, country, payload });

describe("leaving school to work (EDU-004)", () => {
  const poor = at(13, { education: { level: "primary", inSchool: true, years: 6 }, money: moneyAt(25) });
  it("asks an older child from a poor household who is about to leave, when the year has room", () => {
    const step = stepEducation(poor, country, always(0.999), { open: true });
    expect(step.events.find((e) => e.ask)?.ask?.eventId).toBe(LEAVE_DECISION);
    expect(step.person.education.inSchool).toBe(true);
  });
  it("does not ask when the year is full: the child leaves", () => {
    const step = stepEducation(poor, country, always(0.999), { open: false });
    expect(step.events.some((e) => e.ask)).toBe(false);
    expect(step.person.education.inSchool).toBe(false);
  });
  it("does not ask a child from a comfortable household or a young one", () => {
    const rich = { ...poor, money: moneyAt(90) };
    expect(stepEducation(rich, country, always(0.999), { open: true }).events.some((e) => e.ask)).toBe(false);
    const young = at(8, { education: { level: "none", inSchool: true, years: 2 }, money: moneyAt(20) });
    expect(stepEducation(young, country, always(0.999), { open: true }).events.some((e) => e.ask)).toBe(false);
  });
  it("tells a working child's pressure in its own words", () => {
    const working = { ...poor, flags: { childLabour: true } };
    const step = stepEducation(working, country, always(0.999), { open: true });
    expect(step.events.find((e) => e.ask)?.textKey).toBe("event.edu.leave_school_for_work.labour");
  });
  it("draws the same numbers whether or not it asks", () => {
    const a = createRng("edu");
    const b = createRng("edu");
    stepEducation(poor, country, a, { open: true });
    stepEducation(poor, country, b, { open: false });
    expect(a.next()).toBe(b.next());
  });
  it("makes staying likelier for the better off and the able, and for a child who puts points into Learn", () => {
    const base = stayOdds(poor);
    expect(stayOdds({ ...poor, money: moneyAt(60) })).toBeGreaterThan(base);
    expect(stayOdds({ ...poor, traits: { ...poor.traits, aptitude: 2 } })).toBeGreaterThan(base);
    expect(stayOdds({ ...poor, focus: { learn: 1, earn: 0, health: 0, belonging: 0, rest: 0 } })).toBeGreaterThan(base);
    expect(stayOdds({ ...poor, flags: { childLabour: true } })).toBeLessThan(base);
    expect(stayOdds(poor)).toBeGreaterThanOrEqual(0.1);
    expect(stayOdds({ ...poor, money: moneyAt(100), traits: { ...poor.traits, aptitude: 2 } })).toBeLessThanOrEqual(
      0.9,
    );
  });
  const def = systemDecision(LEAVE_DECISION)!;
  const waiting = { ...poor, flags: { childLabour: true } };
  it("locks staying for a working child of the poorest household, with the reason", () => {
    const stuck = { ...waiting, money: moneyAt(10) };
    const views = choiceViews(def, ctx(stuck, { level: "lower-secondary" }));
    expect(views.find((v) => v.id === "stay")?.lockedReason).toBe("lock.cannot_spare");
    expect(views.find((v) => v.id === "leave")?.lockedReason).toBeUndefined();
  });
  it("shows the odds of staying and takes the roll from them", () => {
    const c = ctx(poor, { level: "lower-secondary" });
    const stay = choiceViews(def, c).find((v) => v.id === "stay")!;
    const odds = stayOdds(poor);
    expect(stay.lens.map((l) => l.key)).toEqual(["lens.stay_in_school", "lens.leave_anyway"]);
    expect(stay.lens[0]?.p).toBeCloseTo(odds, 10);
    const kept = resolveChoice(def, "stay", c, always(0));
    expect(kept.effects).toContainEqual(expect.objectContaining({ school: "stay" }));
    const lost = resolveChoice(def, "stay", c, always(0.999));
    expect(lost.effects).toContainEqual({ school: "leave" });
  });
  it("makes leaving the default course", () => {
    expect(defaultChoiceId(def, ctx(poor, { level: "lower-secondary" }))).toBe("leave");
  });
});

describe("higher education (EDU-003)", () => {
  const leaver = at(17, {
    education: { level: "lower-secondary", inSchool: true, years: 11 },
    stats: { health: 70, happiness: 60, belonging: 60, skills: 70 },
    money: moneyAt(70),
  });
  const upperDone = (open: boolean) => stepEducation(leaver, country, always(0), { open });
  it("is offered when upper secondary school is completed and the year has room", () => {
    expect(upperDone(true).events.find((e) => e.ask)?.ask?.eventId).toBe(HIGHER_DECISION);
    expect(upperDone(false).events.some((e) => e.ask)).toBe(false);
  });
  const def = systemDecision(HIGHER_DECISION)!;
  it("shows the cost and the odds of finishing", () => {
    const views = choiceViews(def, ctx(leaver));
    const enrol = views.find((v) => v.id === "try")!;
    expect(enrol.cost).toEqual({ amount: tertiaryYearlyCost(ctx(leaver).country), perYear: true, borneInSchool: true });
    expect(enrol.lens[0]?.key).toBe("lens.finish_degree");
  });
  it("locks the scholarship until the results are strong enough", () => {
    const weak = { ...leaver, stats: { ...leaver.stats, skills: SCHOLARSHIP_MIN_SKILLS - 5 } };
    expect(choiceViews(def, ctx(weak)).find((v) => v.id === "scholarship")?.lockedReason).toBe(
      "lock.scholarship_skills",
    );
    expect(choiceViews(def, ctx(leaver)).find((v) => v.id === "scholarship")?.lockedReason).toBeUndefined();
  });
  it("never makes a scholarship likely or impossible, and rewards skills", () => {
    expect(scholarshipOdds(leaver)).toBeGreaterThan(0.03);
    expect(scholarshipOdds(leaver)).toBeLessThanOrEqual(0.6);
    expect(scholarshipOdds({ ...leaver, stats: { ...leaver.stats, skills: 95 } })).toBeGreaterThan(
      scholarshipOdds(leaver),
    );
    const p = outcomeProbabilities(
      def.choices!.find((c) => c.id === "scholarship")!,
      ctx(leaver),
    );
    expect(p[0]).toBeCloseTo(scholarshipOdds(leaver), 10);
    expect(p[0]! + p[1]!).toBeCloseTo(1, 10);
  });
  it("charges the fees to a student who takes them on, and not to one with a scholarship", () => {
    const c = ctx(leaver);
    const paying = applyEffectsToPerson(
      leaver,
      resolveChoice(def, "try", c, always(0)).effects,
      "choice",
      country,
    ).person;
    const funded = applyEffectsToPerson(
      leaver,
      resolveChoice(def, "scholarship", c, always(0)).effects,
      "choice",
      country,
    ).person;
    expect(paying.education.inSchool).toBe(true);
    expect(funded.education.inSchool).toBe(true);
    const student = (p: Person) => ({ ...p, age: 19 });
    const debtAfter = (p: Person) => stepMoney(student(p), country, always(0)).person.money.debt;
    expect(debtAfter(paying)).toBeGreaterThanOrEqual(tertiaryYearlyCost(country));
    expect(debtAfter(funded)).toBe(funded.money.debt);
  });
  it("charges the last year of a course too, and stops the fees once the studies end", () => {
    const c = ctx(leaver);
    const paying = applyEffectsToPerson(
      leaver,
      resolveChoice(def, "try", c, always(0)).effects,
      "choice",
      country,
    ).person;
    const graduate = { ...paying, age: 21, education: { ...paying.education, inSchool: false } };
    const worth = (p: Person) => p.money.savings - p.money.debt;
    const charged = stepMoney(graduate, country, always(0), true).person;
    const free = stepMoney(graduate, country, always(0), false).person;
    expect(worth(free) - worth(charged)).toBeCloseTo(tertiaryYearlyCost(country), 6);
    expect(charged.flags.tuition).toBe(false);
    expect(stepMoney(charged, country, always(0), false).person.flags.tuition).toBe(false);
  });
  it("shows no cost to a child that the household would bear", () => {
    const child = at(14, { education: { level: "primary", inSchool: true, years: 8 } });
    const pneumoniaChild = { ...child, conditions: [{ id: "pneumonia", severity: 2 as const, since: 13 }] };
    const care = choiceViews(systemDecision(CARE_DECISION)!, ctx(pneumoniaChild, { condition: "pneumonia" }));
    expect(care.find((v) => v.id === "best")?.cost).toBeUndefined();
    expect(care.find((v) => v.id === "best")).toBeDefined();
  });
  it("enrols on the first two courses and finishes studying on the third", () => {
    const c = ctx(leaver);
    expect(resolveChoice(def, "try", c, always(0)).effects).toContainEqual({ school: "enrol-tertiary" });
    expect(resolveChoice(def, "work", c, always(0)).effects).toContainEqual({ school: "finish" });
  });
});

describe("care (HEALTH-005, MONEY-005)", () => {
  const pneumonia = conditionCatalog.get("pneumonia")!;
  const ill = at(30, {
    work: { status: "employed", yearsWorked: 8, attachment: 0.5, sector: "services", formal: true },
    conditions: [{ id: "pneumonia", severity: 2, since: 29 }],
  });
  const def = systemDecision(CARE_DECISION)!;
  const c = ctx(ill, { condition: "pneumonia" });

  it("costs more for the best care, and more where more is paid out of pocket", () => {
    expect(careCost(pneumonia, "best", country)).toBeGreaterThan(careCost(pneumonia, "usual", country));
    const dear = makeCountry({
      money: { ...country.money, healthOutOfPocketShare: { ...country.money.healthOutOfPocketShare, value: 0.6 } },
    });
    expect(careCost(pneumonia, "usual", dear)).toBeGreaterThan(careCost(pneumonia, "usual", country));
  });
  it("changes the odds: the best care makes getting worse rarer, waiting more likely", () => {
    const [worst, usual, best] = [-1, 0, 1].map((level) => conditionOdds(pneumonia, 2, level as -1 | 0 | 1));
    expect(best!.worsen).toBeLessThan(usual!.worsen);
    expect(usual!.worsen).toBeLessThan(worst!.worsen);
    expect(best!.recover).toBeGreaterThan(usual!.recover);
  });
  it("shows what each course does to the odds, with the cost", () => {
    const views = choiceViews(def, c);
    expect(views.map((v) => v.id)).toEqual(["usual", "best", "wait"]);
    const best = views.find((v) => v.id === "best")!;
    expect(best.cost?.amount).toBeCloseTo(careCost(pneumonia, "best", country), 6);
    expect(best.lens[0]?.p).toBeCloseTo(conditionOdds(pneumonia, 2, 1).worsen, 10);
    expect(best.lens[0]?.vs).toBeCloseTo(conditionOdds(pneumonia, 2, 0).worsen, 10);
    expect(views.find((v) => v.id === "wait")?.cost).toBeUndefined();
  });
  it("locks the best care when it could not be paid for even by borrowing", () => {
    const broke = { ...ill, money: moneyAt(1, { debt: 1e6 }) };
    expect(choiceViews(def, ctx(broke, { condition: "pneumonia" })).find((v) => v.id === "best")?.lockedReason).toBe(
      "lock.cannot_afford",
    );
  });
  it("sets the care level and charges the cost", () => {
    const best = resolveChoice(def, "best", c, always(0));
    expect(best.effects).toContainEqual({ care: "pneumonia", level: 1 });
    const applied = applyEffectsToPerson(ill, best.effects, "choice", country).person;
    expect(careLevel(applied, "pneumonia")).toBe(1);
    expect(applied.money.savings - applied.money.debt).toBeLessThan(ill.money.savings - ill.money.debt);
    const wait = resolveChoice(def, "wait", c, always(0));
    expect(careLevel(applyEffectsToPerson(ill, wait.effects, "choice", country).person, "pneumonia")).toBe(-1);
  });
  it("shows the odds of the usual care at the level it sets, even for someone who had the best", () => {
    const best = { ...ill, flags: { ...ill.flags, "care.pneumonia": 1 } };
    const usual = choiceViews(def, ctx(best, { condition: "pneumonia" })).find((v) => v.id === "usual")!;
    expect(usual.lens[0]?.p).toBeCloseTo(conditionOdds(pneumonia, 2, 0).worsen, 10);
    const applied = applyEffectsToPerson(
      best,
      resolveChoice(def, "usual", ctx(best, { condition: "pneumonia" }), always(0)).effects,
      "choice",
      country,
    ).person;
    expect(careLevel(applied, "pneumonia")).toBe(0);
  });
  it("makes the usual care the default", () => {
    expect(defaultChoiceId(def, c)).toBe("usual");
  });

  const certain = (id: string): ConditionDef => ({
    id,
    ages: [0, 100],
    onset: 1,
    worsen: 1,
    recover: 0,
    hazard: 0.3,
    healthPenalty: 2,
    focusCost: [0, 1, 2],
    care: { usual: 0.1, best: 0.3 },
  });
  const catalogOf = (...defs: ConditionDef[]) => ({ all: defs, get: (id: string) => defs.find((d) => d.id === id) });
  const working = { status: "employed", yearsWorked: 5, attachment: 0.5, sector: "services", formal: true } as const;
  const healthy = at(30, { work: working });
  /** Someone who already has each condition at severity 1, so that this year it gets worse. */
  const ailing = (...ids: string[]) =>
    at(30, { work: working, conditions: ids.map((id) => ({ id, severity: 1 as const, since: 28 })) });
  it("asks about a condition that has become serious when the year has room and the person is old enough", () => {
    const step = stepConditions(ailing("a"), country, () => always(0), catalogOf(certain("a")), { open: true });
    expect(step.events.find((e) => e.ask)?.ask).toEqual({ eventId: CARE_DECISION, payload: { condition: "a" } });
  });
  it("gives the usual care, and bills for it, when a condition begins", () => {
    const step = stepConditions(healthy, country, () => always(0), catalogOf(certain("a")), { open: true });
    expect(step.events.some((e) => e.ask)).toBe(false);
    expect(step.events.find((e) => e.id === "health.a.care")?.effects).toContainEqual(
      expect.objectContaining({ money: "cost" }),
    );
  });
  it("gives the usual care, and bills for it, when the year is full", () => {
    const step = stepConditions(ailing("a"), country, () => always(0), catalogOf(certain("a")), { open: false });
    expect(step.events.some((e) => e.ask)).toBe(false);
    expect(step.events.find((e) => e.id === "health.a.care")?.effects).toContainEqual(
      expect.objectContaining({ money: "cost" }),
    );
  });
  it("leaves care to the household for a child", () => {
    const child = at(CARE_ASK_AGE - 1, { conditions: [{ id: "a", severity: 1, since: 8 }] });
    const step = stepConditions(child, country, () => always(0), catalogOf(certain("a")), { open: true });
    expect(step.events.some((e) => e.ask)).toBe(false);
  });
  it("asks about only one condition a year", () => {
    const step = stepConditions(ailing("a", "b"), country, () => always(0), catalogOf(certain("a"), certain("b")), {
      open: true,
    });
    expect(step.events.filter((e) => e.ask)).toHaveLength(1);
  });
  it("draws one number per condition whatever it does", () => {
    const draws: string[] = [];
    const rollFor = (id: string): Rng => ({ ...always(0), next: () => (draws.push(id), 0) });
    stepConditions(ailing("a", "b"), country, rollFor, catalogOf(certain("a"), certain("b")), { open: true });
    expect(draws).toEqual(["a", "b"]);
  });
});

describe("falling in love (REL-003)", () => {
  const def = systemDecision(MEET_DECISION)!;
  const partner = relative({ id: "p1", kind: "partner", name: "Kofi", sex: "male", age: 25 });
  const c = ctx(at(24), { relative: partner });
  it("lets the person pursue it or let it pass", () => {
    expect(choiceViews(def, c).map((v) => v.id)).toEqual(["pursue", "decline"]);
    const pursued = resolveChoice(def, "pursue", c, always(0)).effects;
    expect(pursued).toContainEqual({ relationship: "add", relative: partner });
    const declined = resolveChoice(def, "decline", c, always(0)).effects;
    expect(declined).toContainEqual(expect.objectContaining({ set: "marriageDelay" }));
  });
});

describe("friends (REL-002)", () => {
  const school = at(10, { education: { level: "none", inSchool: true, years: 4 } });
  it("are not made before the age of five", () => {
    expect(friendChance(at(3))).toBe(0);
  });
  it("are likelier at school, for the sociable, and when Belonging has points", () => {
    const plain = at(10);
    expect(friendChance(school)).toBeGreaterThan(friendChance(plain));
    expect(friendChance({ ...plain, traits: { ...plain.traits, sociability: 2 } })).toBeGreaterThan(
      friendChance(plain),
    );
    expect(friendChance({ ...plain, focus: { learn: 0, earn: 0, health: 0, belonging: 1, rest: 0 } })).toBeGreaterThan(
      friendChance(plain),
    );
  });
  it("become rarer the more friends there are", () => {
    const friends = Array.from({ length: 4 }, (_, i) => relative({ id: `f${i}`, kind: "friend" }));
    expect(friendChance({ ...school, relationships: friends })).toBeLessThan(friendChance(school));
  });
  it("adds a named friend when the roll succeeds, and nothing when it fails", () => {
    const made = stepFriends(school, country, always(0));
    const added = made.events[0]?.effects.find((e) => "relationship" in e && e.relationship === "add");
    expect(added).toMatchObject({ relative: { kind: "friend" } });
    expect(made.events[0]?.vars?.friend).toBe((added as { relative: Relationship }).relative.name);
    const none = stepFriends(school, country, always(0.99));
    expect(none.events).toEqual([]);
  });
  it("end when the closeness has faded", () => {
    const faded = relative({ id: "f", kind: "friend", closeness: FRIENDSHIP_ENDS_BELOW - 1 });
    const step = stepFriends({ ...school, relationships: [faded] }, country, always(0.99));
    expect(step.events.map((e) => e.id)).toEqual(["friends.drifted"]);
    expect(step.person.relationships).toEqual([]);
  });
  it("draws the same four numbers whatever happens", () => {
    const a = createRng("fr");
    const b = createRng("fr");
    stepFriends(school, country, a);
    stepFriends(at(30), country, b);
    expect(a.next()).toBe(b.next());
  });
});

describe("looking after the family (FAM-005)", () => {
  const parent = relative({ age: 70 });
  it("makes illness likelier with age", () => {
    expect(illOnset(80)).toBeGreaterThan(illOnset(50));
    expect(illOnset(90)).toBeLessThanOrEqual(0.2);
  });
  it("makes a parent ill, and well again", () => {
    const p = at(35, { relationships: [parent] });
    const sick = stepCare(p, always(0));
    expect(sick.person.relationships[0]?.ill).toBe(true);
    expect(sick.events[0]?.id).toBe("family.parent_ill");
    const better = stepCare(sick.person, always(ILL_RECOVERY - 0.01));
    expect(better.person.relationships[0]?.ill).toBe(false);
    expect(better.events[0]?.id).toBe("family.recovered");
    expect(stepCare(sick.person, always(0.99)).events).toEqual([]);
  });
  it("leaves friends and siblings alone, and draws one number for each relative", () => {
    const rels = [relative({ kind: "friend", id: "a" }), relative({ kind: "sibling", id: "b" }), parent];
    const rng = createRng("care");
    const twin = createRng("care");
    const step = stepCare(at(35, { relationships: rels }), rng);
    expect(step.person.relationships.filter((r) => r.ill)).toHaveLength(0);
    for (let i = 0; i < 3; i++) twin.next();
    expect(rng.next()).toBe(twin.next());
  });
  it("shows as a point of Belonging taken from the plan", async () => {
    const { caregivingDuty } = await import("../../src/engine/focus");
    expect(caregivingDuty(at(35, { relationships: [{ ...parent, ill: true }] }))).toBe(true);
    expect(caregivingDuty(at(35, { relationships: [parent] }))).toBe(false);
  });
});

describe("suicide in the cause mix (HEALTH-006)", () => {
  const mix: CauseMix = {
    bands: [[0, 101]],
    female: [{ [SELF_HARM_CAUSE]: 0.5, other: 0.5 }],
    male: [{ [SELF_HARM_CAUSE]: 0.5, other: 0.5 }],
  };
  const withMix = makeCountry({ health: { ...country.health, causeMix: { ...country.health.causeMix, value: mix } } });
  it("is never the cause before the age of twelve", () => {
    for (let i = 0; i < 200; i++) {
      expect(drawCause(withMix, "female", SELF_HARM_FROM_AGE - 1, [], stream("c", "cause", i))).toBe("other");
    }
  });
  it("is drawn at the source's share from twelve", () => {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      if (drawCause(withMix, "male", SELF_HARM_FROM_AGE, [], stream("c", "cause", i)) === SELF_HARM_CAUSE) n++;
    }
    expect(n / 400).toBeGreaterThan(0.4);
    expect(n / 400).toBeLessThan(0.6);
  });
});

describe("money costs (MONEY-005)", () => {
  const worker = at(30, {
    work: { status: "employed", yearsWorked: 5, attachment: 0.5, sector: "services", formal: true },
  });
  it("take savings first, then borrow", () => {
    const saved = { ...worker, money: moneyAt(50, { savings: 10 }) };
    const result = applyEffectsToPerson(saved, [{ money: "cost", incomeShare: 1 }], "chance", country).person;
    expect(result.money.savings).toBe(0);
    expect(result.money.debt).toBeGreaterThan(0);
  });
  it("are not felt by a child, whose household pays", () => {
    const child = at(9);
    const result = applyEffectsToPerson(child, [{ money: "cost", incomeShare: 1 }], "chance", country).person;
    expect(result.money).toEqual(child.money);
  });
});
