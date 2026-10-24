# Project subagents

Claude Code subagents for Birthright live in `.claude/agents/`, one Markdown file each. They were adapted to this repo: each prompt refers only to files, commands and rules that exist here, and to no other agents.

| Agent                  | Use it to                                                                    | Tools                   |
| ---------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| `accessibility-tester` | Audit UI changes for keyboard play, focus, labels, announcements and contrast | no edit tools (plus Bash)|
| `surgeon-reviewer`     | Review a diff for real bugs only, ranked, with a ship verdict                 | no edit tools (plus Bash)|
| `qa-expert`            | Find test gaps against a feature's acceptance criteria                        | no edit tools (plus Bash)|
| `test-automator`       | Write Vitest, React Testing Library and Playwright tests, test-first          | read and write          |
| `docs-drift-editor`    | Fix docs that no longer match a code change, with minimal edits               | edit docs only (no Write) |

## Provenance and licences

The prompts started from agents in [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) (MIT, copyright 2025 VoltAgent), reviewed on 2026-10-24, then rewritten for this repo:

- `accessibility-tester`, `qa-expert`, `test-automator`: from the VoltAgent files of the same names.
- `docs-drift-editor`: from the VoltAgent file of the same name.
- `surgeon-reviewer`: the VoltAgent file credits the Agent Pack collection ([LucianFord/agent-pack](https://github.com/LucianFord/agent-pack), MIT).

How they were chosen: each candidate was scored against a weighted rubric (relevance, fit with `CLAUDE.md`, unique value, tool safety, prompt quality, content fit, cost). Rejected candidates include `frontend-developer` (multi-framework, no knowledge of the kit or `t()`), `code-reviewer` (overlaps `/code-review`) and the infra, backend and orchestration agents.

## Rules for agents

- A new or changed agent must not refer to files, commands, tools or other agents that do not exist in this repo.
- Reviewers get no Write or Edit tools. They keep Bash to run checks, and their prompts forbid using it to change files; that is an instruction, not an enforced sandbox. Give write tools only to agents whose job is to write.
- Agent prompts restate the `CLAUDE.md` rules they depend on; `CLAUDE.md` wins on any conflict.
