---
name: milestone-handoff
description: Write the end-of-phase report for the coordinator, with the suggested prompt that starts the next thread. Use when a Birthright milestone, phase or task is finished and the thread must stop.
---

# Hand off a finished phase

`CLAUDE.md` ("How work flows"): one thread per phase, milestone or task. When yours is finished it stops and does not continue into the next one. It reports to the coordinator, who starts the next thread once Roman has reviewed the PR.

Use this skill after the checks in `CLAUDE.md` ("Before pushing") pass, the `pre-handoff-review` skill has run and the PR is open. Do not start the next phase, not even a small part of it.

## Report

Send the coordinator exactly these sections, in this order, each short. Write "none" rather than leaving one out.

1. **Phase and result.** The milestone or task name, in one sentence what was delivered, and the PR link.
2. **Branch and state.** The branch name, the PR number, whether CI is green, whether it is merged, and anything left uncommitted or unpushed.
3. **Feature IDs.** Each ID delivered, with its status in `docs/features.md` (`done`, or `in progress` and what is left against the acceptance criteria).
4. **Checks run.** The result of each: lint, format:check, typecheck, test, e2e (and calibration, if the change could move mortality).
5. **Review summary.** What each reviewer in `pre-handoff-review` found and how it was resolved, including what was left unfixed and why. Copy the PR description's summary; do not write a second version.
6. **Blockers and decisions for Roman.** Anything unmet, anything that needs a call, anything he has to do himself (merge, enable a setting, supply a source).
7. **Conflicts to expect.** Open PRs or threads touching the same files (`CLAUDE.md`, `docs/agents.md`, `docs/features.md`).
8. **Docs to read.** The `CLAUDE.md` sections, docs and feature IDs the next thread needs, as paths that exist.
9. **Next-thread prompt.** A prompt the coordinator can paste to start the next thread, in a code block. It names the branch to start from (usually `main` after the merge), the feature IDs or task, the docs to read first, the blockers carried over, which agents to use (`frontend-developer` for `src/ui`, `engine-developer` for `src/engine`, `new-event` for content) and the `pre-handoff-review` step before the PR.

## Rules

- State facts you checked (CI status from the PR, the test output), not what you expect.
- Update `ROADMAP.md` for the work you finished (status markers, "Next up", the change log, decisions you made), as `CLAUDE.md` requires. Do not re-plan the next phase in it; the coordinator decides what comes next.
- After sending the report, stop. Do not begin the next phase.
