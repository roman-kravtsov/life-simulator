# Birthright: MVP definition

> **Status (2026-10-26).** The MVP below is built (M1 to M7, 107 of 108 features done). [`ROADMAP.md`](../ROADMAP.md) adds a release gate on top of it (screen reader pass, honesty about authored numbers, no visible defects, Roman's read of the text). The content amounts in section 3 were targets; the game ships more (167 events, 23 reflection prompts, 14 conditions, 163 countries).

The smallest version that still feels like a complete game: one real life, from a real birthplace, to its end, with choices that visibly matter, and a summary worth reading. Roman confirmed (2026-10-23) that the MVP keeps the full scope proposed in Phase 3 (roadmap M1 to M7, 108 features) and that we build it step by step, improving the workflow as we go.

---

## 1. Capabilities and the features that deliver them

| # | The player can... | Features |
|---|---|---|
| 1 | Start a new life | UI-001, UI-002, UI-011, A11Y-001, A11Y-002 |
| 2 | Generate a fictional character | CHAR-001, CHAR-002, CHAR-003, CHAR-004, RNG-001, RNG-002, RNG-003 |
| 3 | Generate starting circumstances | WORLD-001, WORLD-002, WORLD-003, WORLD-004, WORLD-005, WORLD-009, FAM-001, FAM-002, MONEY-001, UI-003, WORLD-008 |
| 4 | Progress through time | SIM-001, SIM-002, SIM-003, SIM-004, SIM-005, TIME-001, TIME-002 |
| 5 | See the character's current state | UI-004, CHAR-004, REL-001, MONEY-007, L10N-002, L10N-003, A11Y-003, A11Y-005, UI-010 |
| 6 | Get events | EVENT-001, EVENT-002, EVENT-003, EVENT-004, EVENT-005, EVENT-006, EVENT-007, ADMIN-001, UI-012 |
| 7 | Make decisions | DEC-001, DEC-002, DEC-003, DEC-004, DEC-005, UI-005, UI-006, EDU-003, REL-003, HEALTH-005 |
| 8 | See consequences applied | SIM-006, EDU-001, EDU-002, EDU-004, CAREER-001, CAREER-002, CAREER-003, CAREER-004, CAREER-006, MONEY-002, MONEY-003, MONEY-004, MONEY-005, MONEY-006, REL-002, REL-004, FAM-003, FAM-004, FAM-005, HEALTH-001, HEALTH-004 |
| 9 | Continue the simulation | TIME-001, TIME-002, UI-007, A11Y-004 |
| 10 | Reach the end of the life | HEALTH-002, HEALTH-003, HEALTH-006, DEATH-001, DEATH-002, DEATH-003, SIM-007 |
| 11 | See a life summary | SUM-001, SUM-002, SUM-003, SUM-004, SUM-005, DEATH-004 |
| 12 | Start another life | SUM-001 (start again), UI-002, UI-008, SAVE-003 |
| 13 | Save and resume locally | SAVE-001, SAVE-002, SAVE-004, SAVE-005, SAVE-007, RNG-004 |

Cross-cutting MVP features not tied to one capability: BE-001 and BE-002 (static site, CI, deploy), ANLT-001 (no tracking), L10N-001 (string keys), RNG-005 (no unseeded randomness), WORLD-007 (sources screen), UI-009 (settings).

Every capability maps to at least one feature, so no new features were needed. All features listed are marked MVP in `docs/features.md`.

## 2. Deliberately left out of the MVP

- **Zoom-in quarters** (M8). The yearly loop must be solid and calibrated first. RNG streams are designed so adding quarters later does not break yearly replays.
- **Conflict and war, migration, separation, domestic violence** (M9). They need extra data sources (UCDP, migrant stock) and careful writing. War deaths still appear through the cause-of-death mix.
- **Auto mode, the other shore, the road not taken, sharing** (M10).
- **Other languages, audio, past and future eras, collections, anything server-side** (M11).
- **Polish:** motion, installable app, first-life hints, automated accessibility audit (M10; A11Y-006 was moved into the MVP later, see `ROADMAP.md`).

## 3. Content needed to feel complete without padding

| Content | Amount | Why |
|---|---|---|
| Countries | **Every country with complete core data**. The pipeline report gives the final count (expected 150 to 180). | Roman's decision; the birth draw needs the full distribution. |
| Narrative events | **About 140**: infancy and childhood 30, adolescence 25, youth 30, adulthood 25, midlife 15, elder 15 | A typical 70-year life sees around 60 to 80 notable events. 140 keeps repeats rare across several playthroughs. |
| Statistical event definitions | **About 20** (school continuation, work entry, marriage, childbirth, sibling birth, job loss, family deaths, conditions and so on) | One per data-driven check. Their text has variants by age and circumstance. |
| Decisions | **About 35** of the narrative events carry choices, at least 5 per stage from age 6 | Enough turning points that every life has real choices. |
| Conditions | **10** chronic conditions and injuries | Enough variety for health to matter (HEALTH-004). |
| Reflection prompts | **15** event-driven prompts | One for each major turning point (UI-007). |
| Death passages | **About 12 cause groups**, each with a normal and a softened version | Every death gets a fitting closing (DEATH-002). |
| Data notes | **About 25** "here, about 1 in N..." lines | Enough to ground the major events in data (EVENT-005). |
| Name lists | **About 20 regional lists**, at least 40 names per sex each | Covers every included country (CHAR-002). |
| Help resources | An international directory link (findahelpline.com); country-specific lines are an open question for Roman (design 7) | Shown after sensitive events (UI-012). |

All text is written by us in English, in the voice of design 1.2.

## 4. How we build it (step by step)

- **One PR per milestone**, M1 to M7, each reviewed by Roman before the next starts. Large milestones (M2 data pipeline, M5 events) may be split into two PRs.
- **Tests first** for engine work, including the replay test (same seed always gives the same life) and the calibration harness against real life expectancy.
- After each milestone we note what to improve in the workflow (CI, tooling, conventions) and fold it into the next one.
- `docs/features.md` statuses are updated in each PR, with the PR link.
- The site deploys to GitHub Pages from M1, so every milestone is visible in a browser, even when the game is still partial.

## 5. Definition of done for the MVP

- The full loop works on a phone about 400 px wide and a 1440 px desktop: start, play to death, see the summary, start again, and resume after reloading the page.
- The engine tests pass, including the replay test and the calibration test (life expectancy within 2 years for sampled countries).
- Every number shown in the game has a source on the sources screen.
- Keyboard and screen-reader play work for the whole loop.
- The site is deployed to GitHub Pages and the final MVP PR is open for review.
