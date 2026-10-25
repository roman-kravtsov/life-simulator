# Project subagents

Claude Code subagents for Birthright live in `.claude/agents/`, one Markdown file each. They were adapted to this repo: each prompt refers only to files, commands and rules that exist here, and only to agents that exist here.

| Agent                  | Use it to                                                                    | Tools                   |
| ---------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| `accessibility-tester` | Audit UI changes for keyboard play, focus, labels, announcements and contrast | no edit tools (plus Bash)|
| `surgeon-reviewer`     | Review a diff for real bugs only, ranked, with a ship verdict                 | no edit tools (plus Bash)|
| `qa-expert`            | Find test gaps against a feature's acceptance criteria                        | no edit tools (plus Bash)|
| `frontend-developer`   | Build or change screens and kit components in `src/ui/`, test-first, with kit-only controls, tokens and `t()` | read and write          |
| `test-automator`       | Write Vitest, React Testing Library and Playwright tests, test-first          | read and write          |
| `engine-developer`     | Build or change the simulation in `src/engine/`, test-first, with seeded streams, immutable state, the life expectancy gate and save compatibility | read and write          |
| `content-reviewer`     | Review changes under `src/content` for tone, sensitivity tags, soft texts, help topics and Belonging naming; run only when `src/content` changes | no edit tools (plus Bash)|
| `docs-drift-editor`    | Fix docs that no longer match a code change or each other, with minimal edits, and report stale code comments | edit docs only (no Write) |

## Project skills

Skills live in `.claude/skills/<name>/SKILL.md`.

| Skill                          | Use it to                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `pre-handoff-review`           | Run the independent review pass before a PR (conditional passes: CSS, accessibility, content)      |
| `new-event`                    | Add or change an event or decision in `src/content`: def, strings, lens, validation, content version |
| `milestone-handoff`            | Write the end-of-phase report and the next-thread prompt for the coordinator                       |
| `vercel-react-best-practices`  | React rules for the client-only SPA (see its `SOURCE.md`)                                          |

## Provenance and licences

The prompts started from agents in [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) (MIT, copyright 2025 VoltAgent), reviewed on 2026-10-24, then rewritten for this repo:

- `frontend-developer`: written for this repo from the rules in `CLAUDE.md` and `docs/design-system.md`, not adapted from VoltAgent (its `frontend-developer` was rejected, see below).
- `accessibility-tester`, `qa-expert`, `test-automator`: from the VoltAgent files of the same names.
- `docs-drift-editor`: from the VoltAgent file of the same name.
- `surgeon-reviewer`: the VoltAgent file credits the Agent Pack collection ([LucianFord/agent-pack](https://github.com/LucianFord/agent-pack), MIT).

- `engine-developer` and `content-reviewer`: written for this repo from `CLAUDE.md` (engine rules, the content rules and the sensitive-content rules), not adapted from VoltAgent. Scored against the rubric below on 2026-10-25: `engine-developer` 345 of 400 (86%, adopt), `content-reviewer` 370 of 400 (92%, adopt).

How they were chosen: each candidate was scored 0 to 4 on seven criteria, multiplied by a weight and summed to a percentage of 400: relevance to the stack and roadmap (25), fit with `CLAUDE.md` (20), unique value over existing tooling (15), tool permissions and safety (15), prompt quality (10), domain fit for content (10), cost and context footprint (5). Candidates that need a framework or language we do not use, add tracking or third-party requests, write outside their task, or have an unclear licence are excluded whatever the score. 80% and above is adopted, 60 to 79% adopted after edits, 40 to 59% reference only, below 40% skipped. Rejected candidates include VoltAgent's `frontend-developer` (multi-framework, no knowledge of the kit or `t()`; replaced by our own tailored version), `code-reviewer` (overlaps `/code-review`) and the infra, backend and orchestration agents.

## Rules for agents

- A new or changed agent must not refer to files, commands, tools or other agents that do not exist in this repo.
- Reviewers get no Write or Edit tools. They keep Bash to run checks, and their prompts forbid using it to change files; that is an instruction, not an enforced sandbox. Give write tools only to agents whose job is to write.
- Agent prompts restate the `CLAUDE.md` rules they depend on; `CLAUDE.md` wins on any conflict.
