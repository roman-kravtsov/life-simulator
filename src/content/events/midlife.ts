// Midlife, 50 to 64 (EVENT-007). Strings are in strings/events/midlife.ts.
import type { Effect } from "../../engine/effects";
import type { EventDef } from "../../engine/events";
import { costShare, withRole } from "./helpers";

const SCREENED_CONDITION = "hypertension";

export const midlifeEvents: readonly EventDef[] = [
  {
    id: "midlife.old_injury",
    stage: ["midlife"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    text: "event.midlife.old_injury",
    effects: [{ stat: "health", add: -4 }],
  },
  {
    id: "midlife.looking_back",
    stage: ["midlife"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 6,
    text: "event.midlife.looking_back",
    effects: [
      { stat: "happiness", add: 1 },
      { stat: "skills", add: 1 },
    ],
  },
  {
    id: "midlife.grandchild_born",
    stage: ["midlife"],
    tier: "major",
    conditions: [{ has: "child" }],
    chance: { kind: "weight", base: 5 },
    cooldownYears: 8,
    text: "event.midlife.grandchild_born",
    effects: [
      { stat: "happiness", add: 3 },
      { stat: "belonging", add: 2 },
    ],
  },
  {
    id: "midlife.reunion",
    stage: ["midlife"],
    roles: ["friend"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    focus: "bond",
    text: "event.midlife.reunion",
    effects: [
      { relationship: "closeness", amount: 6, role: "friend" },
      { stat: "belonging", add: 2 },
    ],
  },
  {
    id: "midlife.garden",
    stage: ["midlife"],
    chance: { kind: "weight", base: 5 },
    cooldownYears: 2,
    quiet: true,
    focus: "rest",
    text: "event.midlife.garden",
    effects: [{ stat: "happiness", add: 2 }],
  },
  {
    id: "midlife.knees",
    stage: ["midlife"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    text: "event.midlife.knees",
    effects: [{ stat: "health", add: -2 }],
  },
  {
    id: "midlife.younger_boss",
    stage: ["midlife"],
    conditions: [{ has: "job" }],
    chance: { kind: "weight", base: 3 },
    cause: "circumstance",
    cooldownYears: 6,
    text: "event.midlife.younger_boss",
    effects: [{ stat: "happiness", add: -2 }],
  },
  {
    id: "midlife.child_wedding",
    stage: ["midlife"],
    tier: "major",
    roles: ["child"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 8,
    text: "event.midlife.child_wedding",
    dataNote: { text: "note.marriage_age", path: "family.meanAgeFirstMarriage" },
    effects: [
      { relationship: "closeness", amount: 3, role: "child" },
      { stat: "happiness", add: 3 },
      { stat: "belonging", add: 3 },
    ],
  },
  {
    id: "midlife.eyes_blur",
    stage: ["midlife"],
    chance: { kind: "weight", base: 3 },
    once: true,
    quiet: true,
    text: "event.midlife.eyes_blur",
    effects: [{ stat: "health", add: -1 }],
  },
  {
    id: "midlife.the_sums",
    stage: ["midlife"],
    conditions: [{ standing: "<", value: 40 }],
    chance: { kind: "weight", base: 3 },
    cause: "circumstance",
    cooldownYears: 6,
    text: "event.midlife.the_sums",
    dataNote: { text: "note.participation", path: "work.labourParticipation" },
    effects: [{ stat: "happiness", add: -2 }],
  },
  {
    id: "midlife.diagnosis_scare",
    stage: ["midlife"],
    chance: { kind: "weight", base: 1.5 },
    cause: "chance",
    sensitivity: "severe",
    helpTopic: "illness",
    cooldownYears: 8,
    text: "event.midlife.diagnosis_scare",
    softText: "event.midlife.diagnosis_scare.soft",
    effects: [
      { stat: "happiness", add: -4 },
      { stat: "health", add: -2 },
    ],
  },

  {
    id: "midlife.fiftieth_year",
    stage: ["midlife"],
    tier: "major",
    conditions: [{ age: [50, 52] }],
    chance: { kind: "weight", base: 6 },
    once: true,
    text: "event.midlife.fiftieth_year",
    effects: [
      { stat: "belonging", add: 2 },
      { stat: "happiness", add: 1 },
    ],
  },
  {
    id: "midlife.pride_in_work",
    stage: ["midlife"],
    tier: "major",
    conditions: [{ has: "job" }, { stat: "skills", op: ">", value: 50 }],
    chance: { kind: "weight", base: 3 },
    once: true,
    text: "event.midlife.pride_in_work",
    effects: [
      { stat: "happiness", add: 3 },
      { stat: "skills", add: 1 },
    ],
  },
  {
    id: "midlife.house_empties",
    stage: ["midlife"],
    tier: "major",
    conditions: [{ has: "child" }],
    chance: { kind: "weight", base: 3 },
    once: true,
    text: "event.midlife.house_empties",
    effects: [
      { stat: "belonging", add: -1 },
      { stat: "happiness", add: 1 },
    ],
  },
  {
    id: "midlife.time_to_yourself",
    stage: ["midlife"],
    tier: "major",
    chance: { kind: "weight", base: 3 },
    once: true,
    focus: "rest",
    text: "event.midlife.time_to_yourself",
    effects: [{ stat: "happiness", add: 3 }],
  },
  // Decisions -------------------------------------------------------------------------------------
  {
    id: "midlife.slow_down",
    stage: ["midlife"],
    conditions: [{ age: [55, 64] }, { has: "job" }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    focus: "health",
    text: "event.midlife.slow_down",
    choices: [
      {
        id: "slow_down",
        text: "choice.midlife.slow_down.slow_down",
        cost: costShare(0.1),
        outcomes: [
          {
            p: 1,
            text: "outcome.midlife.slow_down.slow_down",
            effects: [
              { money: "cost", incomeShare: 0.1 },
              { stat: "health", add: 3 },
              { stat: "happiness", add: 3 },
            ],
          },
        ],
      },
      {
        id: "keep_going",
        text: "choice.midlife.slow_down.keep_going",
        default: true,
        outcomes: [
          {
            p: 1,
            text: "outcome.midlife.slow_down.keep_going",
            effects: [
              { money: "windfall", incomeShare: 0.05 },
              { stat: "health", add: -2 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "midlife.health_check",
    stage: ["midlife"],
    tier: "major",
    conditions: [{ age: [50, 64] }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 10,
    focus: "health",
    text: "event.midlife.health_check",
    choices: [
      {
        id: "go",
        text: "choice.midlife.health_check.go",
        cost: costShare(0.03),
        outcomes: [
          {
            p: 0.2,
            text: "outcome.midlife.health_check.found",
            lens: "lens.found_early",
            effects: ({ person }): Effect[] => [
              { money: "cost", incomeShare: 0.03 },
              ...(person.conditions.some((c) => c.id === SCREENED_CONDITION)
                ? []
                : [
                    { condition: "add", id: SCREENED_CONDITION, severity: 1, raises: "cardiovascular" } as const,
                    { care: SCREENED_CONDITION, level: 1 } as const,
                  ]),
              { stat: "happiness", add: -2 },
            ],
          },
          {
            p: 0.8,
            text: "outcome.midlife.health_check.clear",
            lens: "lens.nothing_found",
            effects: [
              { money: "cost", incomeShare: 0.03 },
              { stat: "happiness", add: 1 },
            ],
          },
        ],
      },
      {
        id: "ignore",
        text: "choice.midlife.health_check.ignore",
        default: true,
        outcomes: [{ p: 1, text: "outcome.midlife.health_check.ignore", effects: [] }],
      },
    ],
  },
  {
    id: "midlife.take_in_grandchild",
    stage: ["midlife"],
    roles: ["child"],
    conditions: [{ has: "child" }],
    chance: { kind: "weight", base: 2 },
    cooldownYears: 6,
    focus: "bond",
    text: "event.midlife.take_in_grandchild",
    choices: [
      {
        id: "take_in",
        text: "choice.midlife.take_in_grandchild.take_in",
        outcomes: [
          {
            p: 1,
            text: "outcome.midlife.take_in_grandchild.take_in",
            effects: withRole("child", 6, [
              { money: "cost", incomeShare: 0.05 },
              { stat: "belonging", add: 3 },
              { stat: "health", add: -1 },
            ]),
          },
        ],
      },
      {
        id: "cannot",
        text: "choice.midlife.take_in_grandchild.cannot",
        default: true,
        outcomes: [
          {
            p: 1,
            text: "outcome.midlife.take_in_grandchild.cannot",
            effects: withRole("child", -4, [{ stat: "happiness", add: -2 }]),
          },
        ],
      },
    ],
  },
  {
    id: "midlife.reach_out_sibling",
    stage: ["midlife"],
    roles: ["sibling"],
    chance: { kind: "weight", base: 2 },
    cooldownYears: 8,
    focus: "bond",
    text: "event.midlife.reach_out_sibling",
    choices: [
      {
        id: "reach_out",
        text: "choice.midlife.reach_out_sibling.reach_out",
        outcomes: [
          {
            p: 0.6,
            text: "outcome.midlife.reach_out_sibling.met",
            lens: "lens.met_halfway",
            effects: withRole("sibling", 12, [
              { stat: "belonging", add: 3 },
              { stat: "happiness", add: 2 },
            ]),
          },
          {
            p: 0.4,
            text: "outcome.midlife.reach_out_sibling.turned_away",
            lens: "lens.turned_away",
            effects: withRole("sibling", -2, [{ stat: "happiness", add: -2 }]),
          },
        ],
      },
      {
        id: "let_be",
        text: "choice.midlife.reach_out_sibling.let_be",
        default: true,
        outcomes: [
          { p: 1, text: "outcome.midlife.reach_out_sibling.let_be", effects: [{ stat: "happiness", add: -1 }] },
        ],
      },
    ],
  },
  {
    id: "midlife.old_dream",
    stage: ["midlife"],
    conditions: [{ age: [50, 62] }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 8,
    focus: "learn",
    text: "event.midlife.old_dream",
    choices: [
      {
        id: "follow",
        text: "choice.midlife.old_dream.follow",
        cost: costShare(0.05),
        outcomes: [
          {
            p: 0.7,
            text: "outcome.midlife.old_dream.fulfilling",
            lens: "lens.fulfilling",
            effects: [
              { money: "cost", incomeShare: 0.05 },
              { stat: "happiness", add: 4 },
              { stat: "skills", add: 2 },
            ],
          },
          {
            p: 0.3,
            text: "outcome.midlife.old_dream.flat",
            lens: "lens.falls_flat",
            effects: [
              { money: "cost", incomeShare: 0.05 },
              { stat: "happiness", add: -1 },
            ],
          },
        ],
      },
      {
        id: "not_now",
        text: "choice.midlife.old_dream.not_now",
        default: true,
        outcomes: [{ p: 1, text: "outcome.midlife.old_dream.not_now", effects: [] }],
      },
    ],
  },
];
