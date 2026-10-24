// Old age, 65 and over (EVENT-007). Strings are in strings/events/elder.ts.
import type { EventDef } from "../../engine/events";
import { withRole } from "./helpers";

export const elderEvents: readonly EventDef[] = [
  {
    id: "elder.stories",
    stage: ["elder"],
    chance: { kind: "weight", base: 6 },
    cooldownYears: 6,
    text: "event.elder.stories",
    effects: [
      { stat: "happiness", add: 3 },
      { stat: "belonging", add: 2 },
    ],
  },
  {
    id: "elder.slower_mornings",
    stage: ["elder"],
    chance: { kind: "weight", base: 5 },
    cooldownYears: 6,
    text: "event.elder.slower_mornings",
    effects: [{ stat: "health", add: -3 }],
  },
  {
    id: "elder.grandchildren_visit",
    stage: ["elder"],
    tier: "major",
    conditions: [{ has: "child" }],
    chance: { kind: "weight", base: 5 },
    cooldownYears: 6,
    focus: "bond",
    text: "event.elder.grandchildren_visit",
    effects: [
      { stat: "happiness", add: 3 },
      { stat: "belonging", add: 2 },
    ],
  },
  {
    id: "elder.old_songs",
    stage: ["elder"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 2,
    quiet: true,
    text: "event.elder.old_songs",
    effects: [{ stat: "happiness", add: 2 }],
  },
  {
    id: "elder.bench",
    stage: ["elder"],
    chance: { kind: "weight", base: 5 },
    cooldownYears: 2,
    quiet: true,
    focus: "rest",
    text: "event.elder.bench",
    effects: [
      { stat: "belonging", add: 1 },
      { stat: "happiness", add: 1 },
    ],
  },
  {
    id: "elder.fall",
    stage: ["elder"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    focus: "health",
    text: "event.elder.fall",
    effects: [
      { stat: "health", add: -4 },
      { stat: "happiness", add: -1 },
    ],
  },
  {
    id: "elder.old_photograph",
    stage: ["elder"],
    chance: { kind: "weight", base: 4 },
    cooldownYears: 3,
    quiet: true,
    text: "event.elder.old_photograph",
    effects: [
      { stat: "happiness", add: 1 },
      { stat: "belonging", add: 1 },
    ],
  },
  {
    id: "elder.empty_chairs",
    stage: ["elder"],
    conditions: [{ age: [70, 120] }],
    chance: { kind: "weight", base: 3 },
    cause: "circumstance",
    cooldownYears: 6,
    text: "event.elder.empty_chairs",
    effects: [
      { stat: "belonging", add: -2 },
      { stat: "happiness", add: -2 },
    ],
  },
  {
    id: "elder.pension_day",
    stage: ["elder"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 3,
    quiet: true,
    text: "event.elder.pension_day",
    effects: [
      { money: "windfall", incomeShare: 0.02 },
      { stat: "happiness", add: 1 },
    ],
  },
  {
    id: "elder.reads_to_children",
    stage: ["elder"],
    conditions: [{ stat: "skills", op: ">", value: 35 }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    text: "event.elder.reads_to_children",
    dataNote: { text: "note.literacy", path: "education.literacy" },
    effects: [
      { stat: "belonging", add: 2 },
      { stat: "happiness", add: 2 },
    ],
  },
  {
    id: "elder.lonely_winter",
    stage: ["elder"],
    conditions: [{ stat: "belonging", op: "<", value: 45 }],
    chance: { kind: "weight", base: 3 },
    sensitivity: "difficult",
    helpTopic: "grief",
    cooldownYears: 6,
    text: "event.elder.lonely_winter",
    softText: "event.elder.lonely_winter.soft",
    effects: [
      { stat: "belonging", add: -3 },
      { stat: "happiness", add: -3 },
    ],
  },

  {
    id: "elder.sixty_five",
    stage: ["elder"],
    tier: "major",
    conditions: [{ age: [65, 67] }],
    chance: { kind: "weight", base: 6 },
    once: true,
    text: "event.elder.sixty_five",
    effects: [
      { stat: "happiness", add: 1 },
      { stat: "belonging", add: 1 },
    ],
  },
  {
    id: "elder.eldest_of_the_family",
    stage: ["elder"],
    tier: "major",
    conditions: [{ age: [70, 120] }],
    chance: { kind: "weight", base: 4 },
    once: true,
    text: "event.elder.eldest_of_the_family",
    effects: [
      { stat: "belonging", add: 3 },
      { stat: "happiness", add: 1 },
    ],
  },
  {
    id: "elder.great_grandchild",
    stage: ["elder"],
    tier: "major",
    conditions: [{ has: "child" }, { age: [70, 120] }],
    chance: { kind: "weight", base: 3 },
    once: true,
    text: "event.elder.great_grandchild",
    effects: [
      { stat: "happiness", add: 3 },
      { stat: "belonging", add: 2 },
    ],
  },
  {
    id: "elder.family_gathering",
    stage: ["elder"],
    tier: "major",
    chance: { kind: "weight", base: 4 },
    cooldownYears: 8,
    focus: "bond",
    text: "event.elder.family_gathering",
    effects: [
      { stat: "belonging", add: 3 },
      { stat: "happiness", add: 2 },
    ],
  },
  {
    id: "elder.birthplace",
    stage: ["elder"],
    tier: "major",
    chance: { kind: "weight", base: 2 },
    once: true,
    text: "event.elder.birthplace",
    effects: [
      { stat: "happiness", add: 2 },
      { stat: "belonging", add: 2 },
    ],
  },
  {
    id: "elder.passing_on_the_trade",
    stage: ["elder"],
    tier: "major",
    conditions: [{ stat: "skills", op: ">", value: 45 }],
    chance: { kind: "weight", base: 3 },
    once: true,
    text: "event.elder.passing_on_the_trade",
    effects: [
      { stat: "belonging", add: 3 },
      { stat: "happiness", add: 2 },
    ],
  },
  {
    id: "elder.rest_advised",
    stage: ["elder"],
    tier: "major",
    conditions: [{ stat: "health", op: "<", value: 50 }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 8,
    focus: "health",
    text: "event.elder.rest_advised",
    effects: [
      { stat: "health", add: 2 },
      { stat: "happiness", add: -1 },
    ],
  },
  // Decisions -------------------------------------------------------------------------------------
  {
    id: "elder.live_with_family",
    stage: ["elder"],
    tier: "major",
    roles: ["child"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 12,
    focus: "bond",
    text: "event.elder.live_with_family",
    choices: [
      {
        id: "move_in",
        text: "choice.elder.live_with_family.move_in",
        outcomes: [
          {
            p: 1,
            text: "outcome.elder.live_with_family.move_in",
            effects: withRole("child", 8, [
              { stat: "belonging", add: 3 },
              { stat: "health", add: 1 },
              { stat: "happiness", add: -1 },
            ]),
          },
        ],
      },
      {
        id: "stay",
        text: "choice.elder.live_with_family.stay",
        default: true,
        outcomes: [
          {
            p: 1,
            text: "outcome.elder.live_with_family.stay",
            effects: withRole("child", -2, [
              { stat: "happiness", add: 2 },
              { stat: "health", add: -1 },
            ]),
          },
        ],
      },
    ],
  },
  {
    id: "elder.write_it_down",
    stage: ["elder"],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 8,
    text: "event.elder.write_it_down",
    choices: [
      {
        id: "write",
        text: "choice.elder.write_it_down.write",
        outcomes: [
          {
            p: 0.6,
            text: "outcome.elder.write_it_down.kept",
            lens: "lens.someone_keeps_it",
            effects: [
              { stat: "belonging", add: 4 },
              { stat: "happiness", add: 3 },
            ],
          },
          {
            p: 0.4,
            text: "outcome.elder.write_it_down.drawer",
            lens: "lens.stays_in_drawer",
            effects: [{ stat: "happiness", add: 1 }],
          },
        ],
      },
      {
        id: "leave",
        text: "choice.elder.write_it_down.leave",
        default: true,
        outcomes: [{ p: 1, text: "outcome.elder.write_it_down.leave", effects: [] }],
      },
    ],
  },
  {
    id: "elder.make_amends",
    stage: ["elder"],
    tier: "major",
    roles: ["friend"],
    chance: { kind: "weight", base: 2 },
    cooldownYears: 12,
    focus: "bond",
    text: "event.elder.make_amends",
    choices: [
      {
        id: "visit",
        text: "choice.elder.make_amends.visit",
        outcomes: [
          {
            p: 0.7,
            text: "outcome.elder.make_amends.forgiven",
            lens: "lens.forgiven",
            effects: withRole("friend", 10, [{ stat: "happiness", add: 3 }]),
          },
          {
            p: 0.3,
            text: "outcome.elder.make_amends.cool",
            lens: "lens.coolly_received",
            effects: withRole("friend", 1, [{ stat: "happiness", add: -1 }]),
          },
        ],
      },
      {
        id: "let_be",
        text: "choice.elder.make_amends.let_be",
        default: true,
        outcomes: [{ p: 1, text: "outcome.elder.make_amends.let_be", effects: [{ stat: "happiness", add: -1 }] }],
      },
    ],
  },
  {
    id: "elder.keep_working",
    stage: ["elder"],
    conditions: [{ age: [65, 78] }],
    chance: { kind: "weight", base: 3 },
    cooldownYears: 6,
    focus: "earn",
    text: "event.elder.keep_working",
    choices: [
      {
        id: "work",
        text: "choice.elder.keep_working.work",
        outcomes: [
          {
            p: 1,
            text: "outcome.elder.keep_working.work",
            effects: [
              { money: "windfall", incomeShare: 0.04 },
              { stat: "health", add: -1 },
              { stat: "belonging", add: 1 },
            ],
          },
        ],
      },
      {
        id: "rest",
        text: "choice.elder.keep_working.rest",
        default: true,
        outcomes: [
          {
            p: 1,
            text: "outcome.elder.keep_working.rest",
            effects: [
              { stat: "health", add: 1 },
              { stat: "belonging", add: -1 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "elder.share_what_you_have",
    stage: ["elder"],
    roles: ["child"],
    chance: { kind: "weight", base: 2 },
    cooldownYears: 8,
    text: "event.elder.share_what_you_have",
    choices: [
      {
        id: "give_now",
        text: "choice.elder.share_what_you_have.give_now",
        outcomes: [
          {
            p: 1,
            text: "outcome.elder.share_what_you_have.give_now",
            effects: withRole("child", 8, [
              { money: "cost", incomeShare: 0.1 },
              { stat: "belonging", add: 3 },
              { stat: "happiness", add: 2 },
            ]),
          },
        ],
      },
      {
        id: "keep",
        text: "choice.elder.share_what_you_have.keep",
        default: true,
        outcomes: [
          {
            p: 1,
            text: "outcome.elder.share_what_you_have.keep",
            effects: withRole("child", -2, [{ stat: "happiness", add: 1 }]),
          },
        ],
      },
    ],
  },
];
