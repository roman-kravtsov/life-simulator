---
name: new-event
description: Add or change a Birthright life event or decision (event def, strings, odds lens, validation, content version). Use for any edit under src/content/events or src/content/strings/events.
---

# Add an event or decision

Events and decisions are content, not engine code (`CLAUDE.md`, "Code rules"). Work test-first and keep the engine untouched; if the event needs a new condition, effect or role, that is an engine change, so stop and do it as one (the `engine-developer` agent).

## 1. Pick the place

- One file per life stage in `src/content/events/` (`early.ts` is infancy and childhood, then `adolescence.ts`, `youth.ts`, `adulthood.ts`, `midlife.ts`, `elder.ts`; `shocks.ts` for rare large events). Strings go in the matching file in `src/content/strings/events/`; lens phrases shared by several events go in `strings/events/lens.ts`.
- Read two neighbouring events in the same file first, and copy their shape. Reuse `ANY_STAGE`, `costShare` and `withRole` from `src/content/events/helpers.ts`.
- The id is dotted lower case and stable: `<stage>.<snake_case>`, for example `childhood.found_coin`. Ids are never renamed or reused; a saved life refers to them.

## 2. Write the event def (`EventDef` in `src/engine/events.ts`)

- `stage`, `conditions` (for example `{ age: [6, 11] }`), `chance` (`weight` for narrative events, `fixed` or `indicator` for statistical ones, `scheduled` when something else raises it) and `tier` (`major` or the default minor).
- A repeatable notable event needs `cooldownYears` of at least 6, unless it is `quiet` or `once`. `tests/engine/content.test.ts` enforces it.
- `text` is a string key. The text may only name the event's `roles` (`{friend}`, `{mother}`), and each role needs `roles: [...]` so the event happens only when a living relative can play it.
- `effects` and outcomes use the tagged effects in `src/engine/effects.ts`; set `cause` ("chance" by default, "circumstance" for what the world dealt) so the summary's chance/choice/circumstance shares stay honest.
- A `dataNote` must read a real, sourced indicator (`path` such as `demography.tfr`); its note text uses `{share}`, `{oneIn}` or `{value}`. Never write a number into the text by hand.
- Statistical events take their chance from the country data, so that the odds of the event follow the real odds; do not invent a rate.

## 3. A decision (an event with `choices`)

- One decision a year at most; the pacing in `src/engine/events.ts` handles it, but do not add events meant to bypass it.
- Each choice has an `id`, a `text` key and `outcomes` whose probabilities sum to 1 (or all weights). Mark the course the calibrated models assume as `default: true`. A choice with several outcomes needs a `lens` phrase on each outcome. The odds lens reads these same probabilities; never keep a separate number.
- Use `locks` or `requires` to hide or disable a choice, with a reason string. Money costs go through `cost`, in PPP dollars.
- Choices shift the odds but never escape them: do not make any outcome certain unless the choice truly is.
- Suicide is never a choice or an outcome the player picks.

## 4. Tone and sensitivity checklist

- Reflective and literary, plain and calm; second person, past the player's control rather than moralising. No jokes at someone's expense, no graphic detail, no method, no gore.
- Set `sensitivity: "difficult"` or `"severe"` for death, serious illness, violence, abuse, addiction, self-harm and the like. Such an event needs a `helpTopic` (`suicide`, `violence`, `abuse`, `grief`, `addiction` or `illness`) and a `softText` key (the shorter telling used when softening is on); a severe event is never picked when softening is on.
- Name the stat Belonging, never "bond". Use "Belonging" for the focus area and the stat alike.
- Do not copy text, ideas or data from the reference game.
- All text goes through string keys in `strings/events/*.ts`; nothing hard-coded.

## 5. Test and verify

1. Write the failing test first if the event brings new behaviour (a lock, a role, a follow-up): `tests/engine/events.test.ts`, `tests/engine/decisions.test.ts`, or `tests/engine/content.test.ts` for the size and pacing targets.
2. `npx vitest run tests/engine/validate.test.ts tests/engine/content.test.ts`. `validateEvents` checks that every key exists, outcomes sum to 1, lens phrases and help topics exist, `world` paths resolve, roles, follow-ups and illness ids exist. Fix what it reports; never loosen the validator or a test.
3. The content fingerprint test in `tests/engine/content.test.ts` fails once an event or condition changes as data. That is expected: bump `CONTENT_VERSION` in `src/content/version.ts` (for example `2026.10.1` to `2026.10.2`), then update the pinned version and fingerprint in the test. Do not bump it for a change that only edits text.
4. If the event moves a condition, care or anything that changes the hazard of dying, run `npm run calibrate -- NGA JPN IND` and keep simulated life expectancy within 2 years of the source (`tests/engine/calibration.test.ts`). See `CLAUDE.md` for `HAZARD_OFFSET`.
5. Run the checks in `CLAUDE.md` ("Before pushing"). When `src/content` changed, also run the `content-reviewer` agent on the diff, and update `docs/features.md` (EVENT-007 and the feature the event belongs to) in the same PR.
