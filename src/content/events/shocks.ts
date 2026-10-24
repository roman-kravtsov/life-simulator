// Money shocks (MONEY-006): events that cost a person on their own money, or give them a little. Children
// do not feel them: the household pays. Strings are in strings/events/shocks.ts.
import type { EventDef } from "../../engine/events";

const GROWN: EventDef["stage"] = ["youth", "adulthood", "midlife", "elder"];

export const shockEvents: readonly EventDef[] = [
  {
    id: "shock.theft",
    stage: GROWN,
    chance: { kind: "weight", base: 2 },
    cooldownYears: 6,
    tags: ["money"],
    text: "event.shock.theft",
    effects: [
      { money: "cost", incomeShare: 0.15 },
      { stat: "happiness", add: -2 },
    ],
  },
  {
    id: "shock.storm_damage",
    stage: GROWN,
    chance: {
      kind: "weight",
      base: 1.5,
      modifiers: [{ when: [{ location: "rural" }], multiply: 1.5 }],
    },
    cause: "circumstance",
    cooldownYears: 6,
    tags: ["money"],
    text: "event.shock.storm_damage",
    effects: [
      { money: "cost", incomeShare: 0.2 },
      { stat: "happiness", add: -2 },
    ],
  },
  {
    id: "shock.crop_failure",
    stage: GROWN,
    conditions: [{ sector: "agriculture" }],
    chance: { kind: "weight", base: 3 },
    cause: "circumstance",
    cooldownYears: 6,
    tags: ["money"],
    text: "event.shock.crop_failure",
    dataNote: { text: "note.agriculture", path: "work.sectorShares.agriculture" },
    effects: [
      { money: "cost", incomeShare: 0.3 },
      { stat: "happiness", add: -3 },
    ],
  },
  {
    id: "shock.hospital_bill",
    stage: GROWN,
    chance: { kind: "weight", base: 2 },
    cause: "circumstance",
    cooldownYears: 6,
    tags: ["money"],
    text: "event.shock.hospital_bill",
    dataNote: { text: "note.out_of_pocket", path: "money.healthOutOfPocketShare" },
    effects: [
      { money: "cost", incomeShare: 0.2 },
      { stat: "happiness", add: -2 },
    ],
  },
  {
    id: "shock.fire",
    stage: GROWN,
    conditions: [{ location: "urban" }],
    chance: { kind: "weight", base: 1 },
    cause: "circumstance",
    cooldownYears: 10,
    tags: ["money"],
    text: "event.shock.fire",
    effects: [
      { money: "cost", incomeShare: 0.4 },
      { stat: "happiness", add: -3 },
    ],
  },
  {
    id: "shock.wages_withheld",
    stage: GROWN,
    conditions: [{ has: "job" }],
    chance: { kind: "weight", base: 2 },
    cause: "circumstance",
    cooldownYears: 6,
    tags: ["money"],
    text: "event.shock.wages_withheld",
    dataNote: { text: "note.informal", path: "work.informalShare" },
    effects: [
      { money: "cost", incomeShare: 0.15 },
      { stat: "happiness", add: -3 },
    ],
  },
  {
    id: "shock.price_surge",
    stage: GROWN,
    chance: {
      kind: "weight",
      base: 2,
      modifiers: [{ when: [{ standing: "<", value: 40 }], multiply: 1.5 }],
    },
    cause: "circumstance",
    cooldownYears: 6,
    tags: ["money"],
    text: "event.shock.price_surge",
    effects: [
      { money: "cost", incomeShare: 0.1 },
      { stat: "happiness", add: -1 },
    ],
  },
  {
    id: "shock.scam",
    stage: GROWN,
    chance: { kind: "weight", base: 1.5 },
    cooldownYears: 6,
    tags: ["money"],
    text: "event.shock.scam",
    effects: [
      { money: "cost", incomeShare: 0.15 },
      { stat: "happiness", add: -3 },
      { stat: "belonging", add: -1 },
    ],
  },
  {
    id: "shock.inheritance",
    stage: ["adulthood", "midlife", "elder"],
    chance: { kind: "weight", base: 1.5 },
    cooldownYears: 8,
    tags: ["money"],
    text: "event.shock.inheritance",
    effects: [
      { money: "windfall", incomeShare: 0.3 },
      { stat: "happiness", add: 1 },
    ],
  },
];
