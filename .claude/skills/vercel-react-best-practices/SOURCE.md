# Source and license

- Upstream: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
- Pinned commit: `063bee94c3f4df8453406c830b0a7df0f2860278` (2026-08-28)
- Author: Vercel Engineering
- License: MIT (per the upstream repository README and this skill's `SKILL.md` frontmatter)

Files are copied verbatim from upstream. The upstream `README.md` (build tooling notes) was not copied.

## Relevance to this project

The game is planned as Vite + TypeScript without a UI framework, so the React/Next.js-specific
rules (`rerender-`, `server-`, hydration) only apply if React is adopted later. The framework-agnostic
rules are still useful now: `js-*`, `bundle-*` (dynamic imports, barrel files),
`client-localstorage-schema`, `client-passive-event-listeners`, and `rendering-content-visibility`.

To update, re-copy the folder from upstream and bump the pinned commit above.
