# Birthright: roadmap (original milestone map)

> **History.** The active plan is [`ROADMAP.md`](../ROADMAP.md) in the repository root: it holds the current status, priorities, phases and open decisions, and regroups M8 to M11 into phases. M1 to M7 below are built (see `ROADMAP.md` for the audit). CHAR-007, WORLD-014 and ADMIN-005 were added after this map was made, so they are not in it; they are tracked in `docs/features.md` and `ROADMAP.md`. This file stays as the map from milestones to feature IDs; where the two disagree, `ROADMAP.md` wins.

Derived from `docs/features.md`. Milestones are in dependency order: every feature's dependencies are in the same or an earlier milestone (checked by script when this file was written). Inside a milestone, features are listed roughly in build order.

M1 to M7 together are the proposed MVP: 108 of 164 features. Phase 4 (`docs/mvp.md`) confirms or trims this line before anything is built.

---

## MVP

### M1. Foundations
The project skeleton, CI, deterministic randomness and the engine shell.

BE-001, BE-002, ANLT-001, L10N-001, RNG-001, RNG-002, RNG-005, SIM-001, SIM-003, SIM-006, CHAR-004, UI-001, UI-011

### M2. World data
The pipeline from real sources to compact country files, with attributions.

WORLD-001, WORLD-002, WORLD-003, WORLD-004, WORLD-005, WORLD-007, L10N-002, L10N-003

### M3. A life that runs
Birth, family, money at birth, mortality, and the yearly loop running headless from birth to death, calibrated against life expectancy.

CHAR-001, CHAR-002, CHAR-003, WORLD-009, FAM-001, MONEY-001, HEALTH-002, HEALTH-003, HEALTH-001, EVENT-001, EVENT-002, SIM-005, SIM-004, SIM-002, TIME-001, FAM-003, SIM-007, RNG-003

### M4. Life systems
Schooling, work, income and mobility, relationships, siblings and chronic conditions.

EDU-001, EDU-002, CAREER-001, CAREER-002, CAREER-006, MONEY-002, MONEY-003, MONEY-004, MONEY-007, REL-001, FAM-002, HEALTH-004

### M5. Events and decisions
Event selection, the focus plan, choice cards with the odds lens, romance and children, sensitive content with help resources, and the written MVP event set.

EVENT-003, EVENT-004, EVENT-006, DEC-001, DEC-002, DEC-003, DEC-004, DEC-005, REL-003, REL-004, REL-002, FAM-004, FAM-005, EDU-003, EDU-004, CAREER-003, CAREER-004, HEALTH-005, MONEY-005, MONEY-006, TIME-002, EVENT-005, UI-012, HEALTH-006, ADMIN-001, EVENT-007, UI-005, UI-006

### M6. Death, summary and saves
The end of a life, the rings and the summary, autosave, resume, the archive and replay.

DEATH-001, DEATH-002, DEATH-003, SAVE-001, SAVE-002, SAVE-003, SAVE-004, RNG-004, SAVE-005, SAVE-007, DEATH-004, SUM-001, SUM-002, SUM-003, SUM-004

### M7. Playable game (MVP release)
All screens, responsive layout and accessibility, then deploy and open the MVP pull request.

UI-002, UI-003, UI-004, UI-007, UI-008, UI-009, UI-010, WORLD-008, SUM-005, A11Y-001, A11Y-002, A11Y-003, A11Y-004, A11Y-005

---

## Post-MVP

### M8. Zoom-in quarters
Quarterly sub-steps, the Z1 to Z12 triggers, the quarterly plan and crisis events.

TIME-003, SIM-008, DEC-007, TIME-005, EVENT-009, TIME-004

### M9. Deeper lives
Conflict, migration, separation, domestic violence, career progression, more health, inheritance, regional events and other depth.

WORLD-010, DEC-008, REL-005, REL-007, CAREER-005, HEALTH-007, HEALTH-008, HEALTH-009, HEALTH-010, FAM-006, EDU-006, REL-006, CHAR-005, EVENT-008, MONEY-008, MONEY-009, EDU-005, CAREER-007

### M10. Reflection, replay and sharing
The other shore, the road not taken, seeds you can share, auto mode, tooling and polish.

SUM-006, SUM-007, SUM-008, RNG-006, SHARE-001, SHARE-002, SHARE-003, SAVE-006, DEC-006, ANLT-002, FAM-008, ADMIN-002, ADMIN-003, ADMIN-004, A11Y-006, UI-013, UI-014, UI-015, UI-016, WORLD-006, WORLD-013

### M11. Later
Other languages, audio, past and future eras, collections, and anything needing a server.

L10N-004, L10N-005, AUDIO-001, AUDIO-002, WORLD-011, WORLD-012, ACH-001, ACH-002, ANLT-003, BE-003, FAM-007, CHAR-006
