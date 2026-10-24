// Adulthood, 30 to 49 (EVENT-007). Strings are in strings/events/adulthood.ts.
import type { EventDef } from "../../engine/events";
import { costShare, withRole } from "./helpers";

export const adulthoodEvents: readonly EventDef[] = [
  {
    id: "adulthood.hard_times",
    stage: ["youth", "adulthood", "midlife"],
    chance: {
      kind: "weight",
      base: 2,
      modifiers: [{ when: [{ world: "work.unemployment", op: ">", value: 0.1 }], multiply: 3 }],
    },
    cause: "circumstance",
    cooldownYears: 6,
    text: "event.adulthood.hard_times",
    dataNote: { text: "note.unemployment", path: "work.unemployment" },
    effects: [
      { stat: "happiness", add: -2 },
      { stat: "belonging", add: 1 },
    ],
  },
  {
    id: "adulthood.quiet_evening",
    stage: ["youth", "adulthood"],
    chance: { kind: "weight", base: 6 },
    quiet: true,
    focus: "rest",
    text: "event.adulthood.quiet_evening",
    effects: [{ stat: "happiness", add: 2 }],
  },
  {
    id: "adulthood.market_day",
    stage: ["adulthood"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 2,
    quiet: true,
    text: "event.adulthood.market_day",
    dataNote: { text: "note.services", path: "work.sectorShares.services" },
    effects: [
      { stat: "belonging", add: 1 },
      { stat: "happiness", add: 1 },
    ],
  },
  {
    id: "adulthood.child_first_day",
    stage: ["adulthood"],
    tier: "major",
    conditions: [{ has: "child" }],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 8,
    text: "event.adulthood.child_first_day",
    effects: [
      { stat: "happiness", add: 2 },
      { stat: "belonging", add: 2 },
    ],
  },
  {
    id: "adulthood.sick_child",
    stage: ["adulthood"],
    conditions: [{ has: "child" }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    text: "event.adulthood.sick_child",
    dataNote: { text: "note.out_of_pocket", path: "money.healthOutOfPocketShare" },
    effects: [
      { money: "cost", incomeShare: 0.08 },
      { stat: "happiness", add: -2 },
    ],
  },
  {
    id: "adulthood.child_success",
    stage: ["adulthood"],
    tier: "major",
    roles: ["child"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 8,
    text: "event.adulthood.child_success",
    effects: [
      { relationship: "closeness", amount: 4, role: "child" },
      { stat: "happiness", add: 3 },
      { stat: "belonging", add: 1 },
    ],
  },
  {
    id: "adulthood.parent_visit",
    stage: ["adulthood"],
    roles: ["parent"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 6,
    focus: "bond",
    text: "event.adulthood.parent_visit",
    effects: [
      { relationship: "closeness", amount: 4, role: "parent" },
      { stat: "belonging", add: 1 },
    ],
  },
  {
    id: "adulthood.tired_year",
    stage: ["adulthood"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 6,
    focus: "rest",
    text: "event.adulthood.tired_year",
    effects: [
      { stat: "health", add: -2 },
      { stat: "happiness", add: -1 },
    ],
  },
  {
    id: "adulthood.steady_season",
    stage: ["adulthood"],
    conditions: [{ has: "job" }],
    chance: { kind: "weight", base: 5 },
    cooldownYears: 2,
    quiet: true,
    focus: "earn",
    text: "event.adulthood.steady_season",
    effects: [
      { stat: "happiness", add: 1 },
      { money: "windfall", incomeShare: 0.02 },
    ],
  },
  {
    id: "adulthood.neighbour_help",
    stage: ["adulthood"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 3,
    quiet: true,
    focus: "bond",
    text: "event.adulthood.neighbour_help",
    effects: [{ stat: "belonging", add: 3 }],
  },
  {
    id: "adulthood.crowded_house",
    stage: ["adulthood"],
    conditions: [{ standing: "<", value: 40 }],
    chance: { kind: "weight", base: 3 },
    cause: "circumstance",
    cooldownYears: 4,
    quiet: true,
    text: "event.adulthood.crowded_house",
    effects: [
      { stat: "happiness", add: -1 },
      { stat: "belonging", add: 1 },
    ],
  },
  {
    id: "adulthood.bonus",
    stage: ["adulthood"],
    conditions: [{ has: "job" }, { standing: ">", value: 40 }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    focus: "earn",
    text: "event.adulthood.bonus",
    effects: [
      { money: "windfall", incomeShare: 0.1 },
      { stat: "happiness", add: 2 },
    ],
  },
  {
    id: "adulthood.partner_evening",
    stage: ["adulthood"],
    roles: ["partner"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 6,
    focus: "bond",
    text: "event.adulthood.partner_evening",
    effects: [
      { relationship: "closeness", amount: 4, role: "partner" },
      { stat: "happiness", add: 2 },
    ],
  },
  {
    id: "adulthood.partner_distance",
    stage: ["adulthood"],
    roles: ["partner"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    text: "event.adulthood.partner_distance",
    effects: [
      { relationship: "closeness", amount: -4, role: "partner" },
      { stat: "happiness", add: -2 },
    ],
  },
  {
    id: "adulthood.old_friend_calls",
    stage: ["adulthood"],
    roles: ["friend"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 6,
    text: "event.adulthood.old_friend_calls",
    effects: [
      { relationship: "closeness", amount: 4, role: "friend" },
      { stat: "belonging", add: 2 },
    ],
  },
  {
    id: "adulthood.new_skill",
    stage: ["adulthood"],
    conditions: [{ trait: "curiosity", op: ">", value: 0 }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    focus: "learn",
    text: "event.adulthood.new_skill",
    effects: [
      { stat: "skills", add: 3 },
      { stat: "happiness", add: 1 },
    ],
  },
  {
    id: "adulthood.near_miss",
    stage: ["adulthood"],
    chance: { kind: "weight", base: 2 },
    cooldownYears: 6,
    text: "event.adulthood.near_miss",
    effects: [
      { stat: "health", add: -2 },
      { stat: "happiness", add: -1 },
    ],
  },
  {
    id: "adulthood.workshop_hours",
    stage: ["adulthood"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 3,
    quiet: true,
    focus: "rest",
    text: "event.adulthood.workshop_hours",
    effects: [{ stat: "happiness", add: 2 }],
  },
  {
    id: "adulthood.workplace_dispute",
    stage: ["adulthood"],
    conditions: [{ has: "job" }],
    chance: { kind: "weight", base: 3 },
    cause: "circumstance",
    cooldownYears: 6,
    text: "event.adulthood.workplace_dispute",
    effects: [
      { stat: "happiness", add: -2 },
      { stat: "belonging", add: -1 },
    ],
  },
  {
    id: "adulthood.good_year",
    stage: ["adulthood"],
    chance: { kind: "weight", base: 3 },
    cause: "circumstance",
    cooldownYears: 6,
    text: "event.adulthood.good_year",
    effects: [
      { money: "windfall", incomeShare: 0.1 },
      { stat: "happiness", add: 2 },
    ],
  },

  {
    id: "adulthood.own_roof",
    stage: ["adulthood"],
    tier: "major",
    conditions: [{ age: [30, 45] }, { standing: ">", value: 35 }],
    chance: { kind: "weight", base: 4 },
    once: true,
    focus: "earn",
    text: "event.adulthood.own_roof",
    effects: [
      { stat: "happiness", add: 4 },
      { stat: "belonging", add: 2 },
    ],
  },
  {
    id: "adulthood.asked_to_lead",
    stage: ["adulthood"],
    tier: "major",
    conditions: [{ stat: "skills", op: ">", value: 45 }],
    chance: { kind: "weight", base: 3 },
    once: true,
    text: "event.adulthood.asked_to_lead",
    effects: [
      { stat: "belonging", add: 4 },
      { stat: "happiness", add: 2 },
    ],
  },
  {
    id: "adulthood.long_friendship",
    stage: ["adulthood"],
    tier: "major",
    roles: ["friend"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 10,
    focus: "bond",
    text: "event.adulthood.long_friendship",
    effects: [
      { relationship: "closeness", amount: 8, role: "friend" },
      { stat: "belonging", add: 3 },
    ],
  },
  // Decisions -------------------------------------------------------------------------------------
  {
    id: "adulthood.second_job",
    stage: ["adulthood"],
    conditions: [{ has: "job" }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    focus: "earn",
    text: "event.adulthood.second_job",
    choices: [
      {
        id: "take",
        text: "choice.adulthood.second_job.take",
        outcomes: [
          {
            p: 1,
            text: "outcome.adulthood.second_job.take",
            effects: [
              { money: "windfall", incomeShare: 0.15 },
              { stat: "health", add: -3 },
              { stat: "happiness", add: -1 },
            ],
          },
        ],
      },
      {
        id: "decline",
        text: "choice.adulthood.second_job.decline",
        default: true,
        outcomes: [
          {
            p: 1,
            text: "outcome.adulthood.second_job.decline",
            effects: [{ stat: "happiness", add: 1 }],
          },
        ],
      },
    ],
  },
  {
    id: "adulthood.school_fees",
    stage: ["adulthood"],
    roles: ["child"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    text: "event.adulthood.school_fees",
    dataNote: { text: "note.lower_secondary", path: "education.lowerSecondaryCompletion" },
    choices: [
      {
        id: "pay",
        text: "choice.adulthood.school_fees.pay",
        default: true,
        cost: costShare(0.2),
        outcomes: [
          {
            p: 1,
            text: "outcome.adulthood.school_fees.pay",
            effects: withRole("child", 3, [
              { money: "cost", incomeShare: 0.2 },
              { stat: "happiness", add: 2 },
            ]),
          },
        ],
      },
      {
        id: "work",
        text: "choice.adulthood.school_fees.work",
        outcomes: [
          {
            p: 1,
            text: "outcome.adulthood.school_fees.work",
            effects: withRole("child", -4, [
              { money: "windfall", incomeShare: 0.1 },
              { stat: "happiness", add: -2 },
            ]),
          },
        ],
      },
    ],
  },
  {
    id: "adulthood.partner_argument",
    stage: ["adulthood"],
    roles: ["partner"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    focus: "bond",
    text: "event.adulthood.partner_argument",
    choices: [
      {
        id: "talk",
        text: "choice.adulthood.partner_argument.talk",
        default: true,
        outcomes: [
          {
            p: 0.7,
            text: "outcome.adulthood.partner_argument.heard",
            lens: "lens.heard",
            effects: withRole("partner", 8, [{ stat: "happiness", add: 2 }]),
          },
          {
            p: 0.3,
            text: "outcome.adulthood.partner_argument.not_heard",
            lens: "lens.not_heard",
            effects: withRole("partner", -4, [{ stat: "happiness", add: -2 }]),
          },
        ],
      },
      {
        id: "leave_it",
        text: "choice.adulthood.partner_argument.leave_it",
        outcomes: [
          {
            p: 1,
            text: "outcome.adulthood.partner_argument.leave_it",
            effects: withRole("partner", -3, [{ stat: "happiness", add: -1 }]),
          },
        ],
      },
    ],
  },
  {
    id: "adulthood.neighbour_dispute",
    stage: ["adulthood"],
    chance: { kind: "weight", base: 2 },
    cooldownYears: 6,
    text: "event.adulthood.neighbour_dispute",
    choices: [
      {
        id: "negotiate",
        text: "choice.adulthood.neighbour_dispute.negotiate",
        default: true,
        outcomes: [
          {
            p: 0.65,
            text: "outcome.adulthood.neighbour_dispute.settled",
            lens: "lens.settled",
            effects: [{ stat: "belonging", add: 2 }],
          },
          {
            p: 0.35,
            text: "outcome.adulthood.neighbour_dispute.stalemate",
            lens: "lens.stalemate",
            effects: [{ stat: "happiness", add: -2 }],
          },
        ],
      },
      {
        id: "press",
        text: "choice.adulthood.neighbour_dispute.press",
        outcomes: [
          {
            p: 0.4,
            text: "outcome.adulthood.neighbour_dispute.won",
            lens: "lens.get_your_way",
            effects: [
              { stat: "happiness", add: 1 },
              { stat: "belonging", add: -2 },
            ],
          },
          {
            p: 0.6,
            text: "outcome.adulthood.neighbour_dispute.feud",
            lens: "lens.feud",
            effects: [
              { stat: "happiness", add: -3 },
              { stat: "belonging", add: -3 },
            ],
          },
        ],
      },
      {
        id: "yield",
        text: "choice.adulthood.neighbour_dispute.yield",
        outcomes: [
          { p: 1, text: "outcome.adulthood.neighbour_dispute.yield", effects: [{ stat: "happiness", add: -1 }] },
        ],
      },
    ],
  },
  {
    id: "adulthood.career_change",
    stage: ["adulthood"],
    tier: "major",
    conditions: [{ age: [35, 49] }, { has: "job" }],
    chance: { kind: "weight", base: 2 },
    cooldownYears: 12,
    focus: "learn",
    text: "event.adulthood.career_change",
    choices: [
      {
        id: "retrain",
        text: "choice.adulthood.career_change.retrain",
        cost: costShare(0.1),
        outcomes: [
          {
            p: 0.55,
            text: "outcome.adulthood.career_change.footing",
            lens: "lens.new_footing",
            effects: [
              { money: "cost", incomeShare: 0.1 },
              { money: "windfall", incomeShare: 0.2 },
              { stat: "skills", add: 4 },
              { stat: "happiness", add: 3 },
            ],
          },
          {
            p: 0.45,
            text: "outcome.adulthood.career_change.setback",
            lens: "lens.setback",
            effects: [
              { money: "cost", incomeShare: 0.15 },
              { stat: "happiness", add: -3 },
              { stat: "skills", add: 1 },
            ],
          },
        ],
      },
      {
        id: "stay",
        text: "choice.adulthood.career_change.stay",
        default: true,
        outcomes: [{ p: 1, text: "outcome.adulthood.career_change.stay", effects: [{ stat: "happiness", add: -1 }] }],
      },
    ],
  },
  {
    id: "adulthood.parent_needs_care",
    stage: ["adulthood"],
    tier: "major",
    roles: ["parent"],
    conditions: [{ age: [35, 49] }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 12,
    focus: "bond",
    text: "event.adulthood.parent_needs_care",
    choices: [
      {
        id: "take_in",
        text: "choice.adulthood.parent_needs_care.take_in",
        outcomes: [
          {
            p: 1,
            text: "outcome.adulthood.parent_needs_care.take_in",
            effects: withRole("parent", 10, [
              { money: "cost", incomeShare: 0.05 },
              { stat: "belonging", add: 3 },
              { stat: "happiness", add: -1 },
            ]),
          },
        ],
      },
      {
        id: "support",
        text: "choice.adulthood.parent_needs_care.support",
        default: true,
        cost: costShare(0.08),
        outcomes: [
          {
            p: 1,
            text: "outcome.adulthood.parent_needs_care.support",
            effects: withRole("parent", 3, [{ money: "cost", incomeShare: 0.08 }]),
          },
        ],
      },
      {
        id: "leave_to_others",
        text: "choice.adulthood.parent_needs_care.leave_to_others",
        outcomes: [
          {
            p: 1,
            text: "outcome.adulthood.parent_needs_care.leave_to_others",
            effects: withRole("parent", -8, [{ stat: "happiness", add: -2 }]),
          },
        ],
      },
    ],
  },
];
