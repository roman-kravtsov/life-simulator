// The decisions the life systems raise themselves (EDU-003, EDU-004, REL-003, REL-004, HEALTH-005).
// They are event definitions like the ones in the content catalog, but their odds and costs come from
// the models, so they live with the engine. A system asks for one by id; the turn keeps the id.
// Their text is in src/content/strings/en.ts under the keys named here.
import { conditionCatalog } from "../content/healthConditions";
import { CARE_DECISION, careCost, careShare, conditionOdds, type CareLevel, type ConditionDef } from "./health";
import { INDEPENDENCE_AGE, TUITION_FLAG, tertiaryYearlyCost, yearlyIncome } from "./money";
import {
  HIGHER_DECISION,
  LEAVE_DECISION,
  SCHOLARSHIP_MIN_SKILLS,
  levelAtAge,
  scholarshipOdds,
  stayOdds,
  tertiaryFinishOdds,
} from "./education";
import type { EventDef } from "./events";
import type { DecisionContext } from "./decisions";
import { DECLINED_DELAY, MEET_DECISION, YOUNG_MARRIAGE_DECISION, YOUNG_MARRIAGE_DELAY, waitOdds } from "./partnership";
import type { EducationLevel, LifeStage, Relationship } from "./types";

const ALL_STAGES: LifeStage[] = ["infancy", "childhood", "adolescence", "youth", "adulthood", "midlife", "elder"];

/** A system decision: never rolled, only raised by its system. */
const decision = (def: Pick<EventDef, "id" | "text" | "choices"> & Partial<EventDef>): EventDef => ({
  stage: ALL_STAGES,
  chance: { kind: "scheduled" },
  ...def,
});

/** A household this poor and a child already at work cannot spare the child for school (EDU-004). */
const POOREST_FOR_SCHOOL = 15;

const levelOf = (ctx: DecisionContext): Exclude<EducationLevel, "none"> => {
  const level = ctx.payload.level as Exclude<EducationLevel, "none"> | undefined;
  if (!level) throw new Error("This decision needs the school level");
  return level;
};

const conditionOf = (ctx: DecisionContext): ConditionDef => {
  const def = conditionCatalog.get(ctx.payload.condition ?? "");
  if (!def) throw new Error("This decision needs a condition");
  return def;
};

/** A person on their own money can borrow up to a year's income; a child's household up to the same, in the child's share. */
const canAfford = (ctx: DecisionContext, amount: number): boolean => {
  const { person } = ctx;
  const income = yearlyIncome(person, ctx.country);
  if (person.age < INDEPENDENCE_AGE || person.education.inSchool) return amount <= income;
  return person.money.savings + income - person.money.debt >= amount;
};

/** What each way of seeing to a condition does to its odds this year, next to what the usual care does. */
const careLens = (ctx: DecisionContext, level: CareLevel) => {
  const def = conditionOf(ctx);
  const current = ctx.person.conditions.find((c) => c.id === def.id)?.severity ?? 1;
  const here = conditionOdds(def, current, level);
  const usual = conditionOdds(def, current, 0);
  return [
    ...(here.worsen > 0 || usual.worsen > 0
      ? [{ key: "lens.condition_worsens", p: here.worsen, vs: usual.worsen }]
      : []),
    { key: "lens.condition_eases", p: here.recover, vs: usual.recover },
  ];
};

const careEffects = (ctx: DecisionContext, kind: "usual" | "best" | "none", level: CareLevel) => {
  const def = conditionOf(ctx);
  return [
    { care: def.id, level },
    ...(kind === "none"
      ? []
      : [{ money: "cost" as const, incomeShare: careShare(def, kind, ctx.person, ctx.country) }]),
  ];
};

const partnerOf = (ctx: DecisionContext): Relationship => {
  if (!ctx.payload.relative) throw new Error("This decision needs the person met");
  return ctx.payload.relative;
};

const delayBy = (ctx: DecisionContext, years: number) => ({
  set: "marriageDelay",
  value: Number(ctx.person.flags.marriageDelay ?? 0) + years,
});

/** What an arranged marriage that goes ahead does. */
const marries = (ctx: DecisionContext, happiness: number) => [
  { relationship: "add" as const, relative: partnerOf(ctx) },
  { set: "married", value: true },
  { set: "marriedAt", value: ctx.person.age },
  { stat: "happiness" as const, add: happiness },
  { stat: "belonging" as const, add: 1 },
];

const defs: readonly EventDef[] = [
  decision({
    id: LEAVE_DECISION,
    text: "event.edu.leave_school_for_work.pressure",
    sensitivity: "none",
    choices: [
      {
        id: "leave",
        text: "choice.edu.leave.leave",
        default: true,
        outcomes: [
          {
            p: 1,
            text: "outcome.edu.leave.leave",
            effects: [{ school: "leave" }, { stat: "happiness", add: -2 }],
          },
        ],
      },
      {
        id: "stay",
        text: "choice.edu.leave.stay",
        locks: [
          {
            when: ({ person }) =>
              person.money.householdPercentile <= POOREST_FOR_SCHOOL && person.flags.childLabour === true,
            reason: "lock.cannot_spare",
          },
        ],
        outcomes: [
          {
            p: ({ person }) => stayOdds(person),
            text: "outcome.edu.leave.stay_ok",
            lens: "lens.stay_in_school",
            effects: (ctx) => {
              const level = levelOf(ctx);
              return [
                { school: "stay", level, completes: ctx.person.age === levelAtAge(ctx.person.age)?.to },
                { stat: "skills", add: 1 },
                { stat: "happiness", add: 1 },
              ];
            },
          },
          {
            p: ({ person }) => 1 - stayOdds(person),
            text: "outcome.edu.leave.stay_fail",
            lens: "lens.leave_anyway",
            effects: [{ school: "leave" }, { stat: "happiness", add: -3 }],
          },
        ],
      },
    ],
  }),
  decision({
    id: HIGHER_DECISION,
    text: "event.edu.higher_education",
    choices: [
      {
        id: "try",
        text: "choice.edu.higher.try",
        default: true,
        cost: (ctx) => ({ amount: tertiaryYearlyCost(ctx.country), perYear: true, borneInSchool: true }),
        lens: ({ person, country }) => [{ key: "lens.finish_degree", p: tertiaryFinishOdds(person, country) }],
        outcomes: [
          {
            p: 1,
            text: "outcome.edu.higher.try",
            effects: [{ school: "enrol-tertiary" }, { set: TUITION_FLAG, value: true }],
          },
        ],
      },
      {
        id: "scholarship",
        text: "choice.edu.higher.scholarship",
        locks: [
          { unless: [{ stat: "skills", op: ">", value: SCHOLARSHIP_MIN_SKILLS }], reason: "lock.scholarship_skills" },
        ],
        lens: ({ person, country }) => [{ key: "lens.finish_degree", p: tertiaryFinishOdds(person, country) }],
        outcomes: [
          {
            p: ({ person }) => scholarshipOdds(person),
            text: "outcome.edu.higher.scholarship_won",
            lens: "lens.win_scholarship",
            effects: [{ school: "enrol-tertiary" }, { stat: "happiness", add: 4 }],
          },
          {
            p: ({ person }) => 1 - scholarshipOdds(person),
            text: "outcome.edu.higher.scholarship_lost",
            lens: "lens.lose_scholarship",
            effects: [{ school: "finish" }, { stat: "happiness", add: -2 }],
          },
        ],
      },
      {
        id: "work",
        text: "choice.edu.higher.work",
        outcomes: [{ p: 1, text: "outcome.edu.higher.work", effects: [{ school: "finish" }] }],
      },
    ],
  }),
  decision({
    id: CARE_DECISION,
    text: "event.health.seek_care",
    choices: [
      {
        id: "usual",
        text: "choice.health.usual",
        default: true,
        cost: (ctx) => ({ amount: careCost(conditionOf(ctx), "usual", ctx.country) }),
        lens: (ctx) => careLens(ctx, 0),
        outcomes: [{ p: 1, text: "outcome.health.usual", effects: (ctx) => careEffects(ctx, "usual", 0) }],
      },
      {
        id: "best",
        text: "choice.health.best",
        cost: (ctx) => ({ amount: careCost(conditionOf(ctx), "best", ctx.country) }),
        locks: [
          {
            when: (ctx) => !canAfford(ctx, careCost(conditionOf(ctx), "best", ctx.country)),
            reason: "lock.cannot_afford",
          },
        ],
        lens: (ctx) => careLens(ctx, 1),
        outcomes: [{ p: 1, text: "outcome.health.best", effects: (ctx) => careEffects(ctx, "best", 1) }],
      },
      {
        id: "wait",
        text: "choice.health.wait",
        lens: (ctx) => careLens(ctx, -1),
        outcomes: [{ p: 1, text: "outcome.health.wait", effects: (ctx) => careEffects(ctx, "none", -1) }],
      },
    ],
  }),
  decision({
    id: MEET_DECISION,
    text: "event.rel.meet_partner",
    choices: [
      {
        id: "pursue",
        text: "choice.rel.pursue",
        default: true,
        outcomes: [
          {
            p: 1,
            text: "outcome.rel.pursue",
            effects: (ctx) => [
              { relationship: "add", relative: partnerOf(ctx) },
              { stat: "happiness", add: 2 },
            ],
          },
        ],
      },
      {
        id: "decline",
        text: "choice.rel.decline",
        outcomes: [{ p: 1, text: "outcome.rel.decline", effects: (ctx) => [delayBy(ctx, DECLINED_DELAY)] }],
      },
    ],
  }),
  decision({
    id: YOUNG_MARRIAGE_DECISION,
    text: "event.rel.young_marriage",
    sensitivity: "difficult",
    helpTopic: "abuse",
    choices: [
      {
        id: "accept",
        text: "choice.rel.young_accept",
        default: true,
        outcomes: [{ p: 1, text: "outcome.rel.young_accept", effects: (ctx) => marries(ctx, -3) }],
      },
      {
        id: "wait",
        text: "choice.rel.young_wait",
        outcomes: [
          {
            p: ({ person }) => waitOdds(person),
            text: "outcome.rel.young_wait_works",
            lens: "lens.wait_works",
            effects: (ctx) => [delayBy(ctx, YOUNG_MARRIAGE_DELAY), { stat: "happiness", add: 1 }],
          },
          {
            p: ({ person }) => 1 - waitOdds(person),
            text: "outcome.rel.young_wait_fails",
            lens: "lens.wait_fails",
            effects: (ctx) => marries(ctx, -4),
          },
        ],
      },
    ],
  }),
];

const byId = new Map(defs.map((def) => [def.id, def]));

export const systemDecisions = defs;

export const systemDecision = (id: string): EventDef | undefined => byId.get(id);
