// The version of the game's content: events, their text and the content rules. A save carries it (SAVE-004), and a
// replay is exact only for the same version (RNG-004). Bump it when a change to events or content could make a
// logged life play differently; `tests/engine/content.test.ts` pins a fingerprint of the catalog to remind you.
export const CONTENT_VERSION = "2026.10.3";
