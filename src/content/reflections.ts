// Reflection prompts as data (UI-007, design 3.7). Each one waits for something that happened in the year, never
// for an age; the order is the order of choice when a year has several, so the most personal comes first. The
// words are in src/content/strings/reflection.ts. Prompts are questions or invitations and are never demands: the
// player may leave any of them unanswered.
import type { ReflectionDef } from "../engine/reflection";

// The first loss of any kind is offered a pause; later, only the deaths of the closest, or the years would fill up.
const CLOSE_DEATHS = ["family.mother_died", "family.father_died", "family.child_died", "family.partner_died"];
const ANY_DEATH = [...CLOSE_DEATHS, "family.friend_died", "family.relative_died"];

export const reflections: readonly ReflectionDef[] = [
  { id: "loss.first", text: "reflection.loss.first", events: ANY_DEATH, first: true },
  { id: "loss.later", text: "reflection.loss.later", events: CLOSE_DEATHS },
  { id: "health.diagnosis", text: "reflection.health.diagnosis", events: ["health.*.begins"], first: true },
  { id: "work.lost", text: "reflection.work.lost", events: ["work.job_lost"] },
  {
    id: "love.wed",
    text: "reflection.love.wed",
    events: ["rel.marriage", "rel.young_marriage", "rel.young_marriage_arranged"],
  },
  { id: "love.met", text: "reflection.love.met", events: ["rel.meet_partner"], first: true },
  { id: "child.born", text: "reflection.child.born", events: ["family.child_born"], first: true },
  {
    id: "grandchild.born",
    text: "reflection.grandchild.born",
    events: ["midlife.grandchild_born", "elder.great_grandchild"],
  },
  { id: "sibling.born", text: "reflection.sibling.born", events: ["family.sibling_born"], first: true },
  { id: "move", text: "reflection.move", effect: "move" },
  { id: "work.retired", text: "reflection.work.retired", events: ["work.retires"] },
  { id: "stage.childhood", text: "reflection.stage.childhood", stage: "childhood" },
  { id: "stage.adolescence", text: "reflection.stage.adolescence", stage: "adolescence" },
  { id: "stage.youth", text: "reflection.stage.youth", stage: "youth" },
  { id: "stage.adulthood", text: "reflection.stage.adulthood", stage: "adulthood" },
  { id: "stage.midlife", text: "reflection.stage.midlife", stage: "midlife" },
  { id: "stage.elder", text: "reflection.stage.elder", stage: "elder" },
  { id: "school.left", text: "reflection.school.left", events: ["school.left"] },
  { id: "school.done", text: "reflection.school.done", events: ["school.completed"], first: true },
  { id: "work.first", text: "reflection.work.first", events: ["work.starts"], first: true },
  { id: "school.start", text: "reflection.school.start", events: ["school.starts"] },
  { id: "money.debt", text: "reflection.money.debt", events: ["money.debt_pressure"], first: true },
  { id: "friend.first", text: "reflection.friend.first", events: ["friends.made"], first: true },
];
