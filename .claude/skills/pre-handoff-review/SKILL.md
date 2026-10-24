---
name: pre-handoff-review
description: Run the independent review pass (parallel fresh-context reviewers, then a documentation coherence check) before opening a PR or asking Roman to review. Use when your work is done and checks pass, before you push for review or hand off.
---

# Independent review before hand-off

Before opening a PR, and before asking Roman to review, run an independent review pass. Skip the reviewers below for changes that touch only docs, data, or tooling and config files (`.claude/`, CI workflows); the documentation step at the end has its own trigger. Spawn the reviewers in parallel, each with fresh context. Give each one its inputs: the diff vs the base branch (`git fetch origin main`, then `git diff origin/main...HEAD`; pass the reviewers this command or the diff text, and commit each round's fixes first, because a three-dot diff does not show uncommitted changes), `CLAUDE.md`, and the `docs/features.md` rows (feature IDs and acceptance criteria) for the feature IDs in the PR. Skip the acceptance pass if the PR delivers no feature IDs.

- **`surgeon-reviewer` (acceptance):** checks that each feature ID's acceptance criteria are met and tested. An unmet criterion is a blocker.
- **`surgeon-reviewer` (correctness and React):** always runs unless the whole pass is skipped; checks correctness, React patterns per `.claude/skills/vercel-react-best-practices` (its `SKILL.md` index plus the rule files it needs, in addition to the shared inputs), and performance.
- **`surgeon-reviewer` (CSS), only if a `*.css` or `*.module.css` file or a design token (`src/styles.css`) is added, changed or deleted, or the markup of `src/ui/kit` changes:** checks token use, layout, responsiveness and dead styles.
- **`accessibility-tester`, only if anything under `src/ui` or `src/styles.css` changes.**

`surgeon-reviewer` normally ignores missing features and style. For the acceptance and CSS passes, say in the prompt that this pass overrides those exclusions: unmet acceptance criteria and CSS problems are in scope for it.

Reviewers only report; the implementer fixes. Their prompts must say not to edit files, so each pass stays independent. The agents have no Write or Edit tools, but they keep Bash to run checks and read-only git commands.

Every finding has a severity (**blocker**, **should-fix** or **nit**), a `path:line` and the evidence. The agents use their own tiers, so ask for this format on top of them: `surgeon-reviewer` WILL BREAK is a blocker, WILL COST a should-fix, WILL ROT a should-fix or a nit by judgement; `accessibility-tester` Blocker, Serious and Minor map to blocker, should-fix and nit.

- Fix every blocker and should-fix, run the checks in "Before pushing" again, and re-run only the reviewers that found problems. The first review is round 1; after the re-run in round 2, stop and report whatever is still unresolved; an unresolved blocker goes to Roman as a blocker in the hand-off. Code fixes made after the documentation step need the checks in "Before pushing" again.
- **Documentation coherence, last:** once the fixes above are in, run `docs-drift-editor` with the final diff. It checks that the docs, `CLAUDE.md`, `README.md`, and the comments and references in the changed files agree with the code and with each other, with no contradictory statements and no stale or wrong file paths, commands, feature IDs, statuses or links. It edits only Markdown, with minimal edits, and reports stale code comments for the implementer to fix. Run it on every PR except one that only regenerates data (tooling and config PRs and docs-only PRs included), and review its edits in the diff. It does not count toward the 2 rounds.
- The hand-off to Roman includes a short summary of each reviewer's findings and how they were resolved, including any left unfixed (nits, or findings you chose not to fix) and why.
