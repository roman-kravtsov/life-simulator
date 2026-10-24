# Source and license

- Upstream: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
- Pinned commit: `063bee94c3f4df8453406c830b0a7df0f2860278` (2026-08-28)
- Author: Vercel Engineering
- License: MIT (per the upstream repository README and this skill's `SKILL.md` frontmatter)

This is a trimmed copy, not a verbatim one. The upstream `README.md` was not copied. To update, diff
against upstream at a newer commit, re-apply the trims below and bump the pinned commit.

## Why it was trimmed (2026-10-24)

Birthright is a client-only React 19 + Vite SPA on GitHub Pages: no server, Next.js, RSC, SWR or
third-party scripts. An agent that preloads this skill via `skills:` frontmatter (planned for the frontend-developer agent)
loads `SKILL.md` on every run, so it is a ~4 KB index (was ~7 KB) and rules are read one file at a time.

## Removed

- `AGENTS.md` (108 KB): a concatenation of every rule, already available as `rules/*.md`. Loading it
  costs ~27k tokens for no extra content. `SKILL.md` indexes the rule files instead, so only the
  rules an agent picks are read.
- `rules/_template.md`, `rules/_sections.md`: upstream authoring and build files.
- `server-*` (10 rules): RSC, `React.cache`, `after()`, server actions, LRU across requests. No server.
- `async-api-routes`, `async-suspense-boundaries` (server streaming), `async-dependencies` (needs
  `better-all`), `async-cheap-condition-before-await` (remote feature flags).
- `bundle-defer-third-party` (analytics and logging; we use no third-party requests).
- `client-swr-dedup`: SWR is not used.
- `rendering-hydration-no-flicker`, `rendering-hydration-suppress-warning`: no SSR.
- `rendering-resource-hints`, `rendering-script-defer-async`: Vite handles script tags and the app has
  no server-rendered head.
- `rendering-activity`: not needed for current screens; add back if screens start hiding and restoring state.

## Kept (49 rules)

`async-defer-await`, `async-parallel` (data loading), `bundle-analyzable-paths` (cut to its Vite import-path half), `bundle-barrel-imports`, `bundle-conditional`,
`bundle-dynamic-imports`, `bundle-preload`, `client-event-listeners`, `client-localstorage-schema`
(saves), `client-passive-event-listeners`, all 15 `rerender-*`, `rendering-animate-svg-wrapper`,
`rendering-svg-precision` (tree rings), `rendering-content-visibility` (long event log),
`rendering-hoist-jsx`, `rendering-conditional-render`, `rendering-usetransition-loading`, all 14
`js-*` (engine and data hot paths), and the 4 `advanced-*` rules.

## Edited kept rules

- `async-defer-await`: dropped the link to the removed flag rule.
- `bundle-analyzable-paths`: kept only the import-path guidance; dropped the Next.js file-tracing half.
- `bundle-barrel-imports`: dropped the Next.js `optimizePackageImports` section.
- `bundle-dynamic-imports`: `next/dynamic` replaced with `React.lazy` and `Suspense`.
- `client-event-listeners`: `useSWRSubscription` replaced with a plain shared listener.
- `bundle-conditional`, `bundle-preload`: dropped `typeof window` SSR guards and the SSR notes.
- `metadata.json`: abstract and references cut to what remains.
