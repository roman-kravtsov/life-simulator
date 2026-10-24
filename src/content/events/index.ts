// Event content as data (EVENT-001, EVENT-007). One file per life stage; text lives in
// src/content/strings/events/ under the keys named here.
import { createCatalog, type EventDef } from "../../engine/events";
import { adolescenceEvents } from "./adolescence";
import { adulthoodEvents } from "./adulthood";
import { earlyEvents } from "./early";
import { elderEvents } from "./elder";
import { midlifeEvents } from "./midlife";
import { shockEvents } from "./shocks";
import { youthEvents } from "./youth";

export const eventDefs: readonly EventDef[] = [
  ...earlyEvents,
  ...adolescenceEvents,
  ...youthEvents,
  ...adulthoodEvents,
  ...midlifeEvents,
  ...elderEvents,
  ...shockEvents,
];

export const catalog = createCatalog(eventDefs);
