## Feature IDs

<!-- The feature IDs this PR delivers (for example SIM-001, UI-004), or the milestone (M7). Their status in docs/features.md is updated in this PR. -->

## What changed and why

## Checks run

<!-- Paste the result of each. In the cloud sandbox, e2e runs as: PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e -->

- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run e2e`
- [ ] `npm run calibrate -- NGA JPN IND` (only if mortality, hazard, drift or conditions changed)

## Review summary

<!-- From the pre-handoff-review skill (.claude/skills/pre-handoff-review/SKILL.md): what each reviewer found and how it was resolved, including anything left unfixed and why. Write "reviewers skipped" with the reason for a docs, data or tooling-only change. -->

## Rules checklist

- [ ] `CLAUDE.md` is updated if this changes the architecture, a convention, the stack or a check
- [ ] `CONTENT_VERSION` is bumped if events or conditions changed in a way that could change a logged life
- [ ] Player-facing text goes through `t()`; Belonging is never called "bond"
- [ ] No tracking, analytics or third-party requests

## For Roman

<!-- Anything you need to do or decide: settings to enable, sources to supply, questions. Write "nothing" if there is none. -->
