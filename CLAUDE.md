# Birthright: working conventions

## The game

Birthright is a browser game in which the player lives one person's life from birth to death. The birthplace, family and household wealth are drawn by the real odds of birth today, using public statistics from the UN, World Bank, WHO and others. Each year the player spends a few focus points (Learn, Earn, Health, Bond, Rest) and faces events and decisions, and the outcomes are shaped by real data on schooling, work, income, marriage, illness and death in that country. Choices shift the odds but never escape them, and an "odds lens" shows by how much. The tone is reflective and literary, hard topics are handled honestly but never graphically, and at the end the life is shown as tree rings with a summary of what came from chance, choice and circumstance. It is free, non-commercial, runs entirely in the browser and saves locally.

The visible stats are Health, Happiness, Belonging and Skills (ids `health`, `happiness`, `belonging`, `skills`). They are not the same as the yearly focus areas; Bond is a focus area that raises Belonging. Use these names everywhere.

## Keeping these conventions

- **Follow every rule in this file on every change**, in every session. If a rule seems wrong for a task, ask Roman instead of quietly breaking it.
- **Keep this file current.** When a change alters the architecture, a convention, the stack or a check, update `CLAUDE.md` in the same PR. When Roman sets a new rule, add it here.
- **Rules are enforced by tooling where possible** (ESLint, guard tests in `tests/guards.test.ts`, CI). When a convention can be checked automatically, add a check instead of relying on memory.

## Architecture

```
public/data/        baked country data (index.json + countries/<ISO3>.json), built by `npm run data`
scripts/data/       data pipeline: lib/ (cache, csv), extract/ (one file per publisher), assemble.ts
                    (completeness filter and fallbacks), sources.ts (licences), build.ts, report.ts
                    Downloads go to the git-ignored .cache/data; the exclusion report is docs/data-report.md
src/engine/         pure TypeScript simulation: no React, no DOM, no I/O
  rng.ts            seeded PRNG and independent streams per subsystem and period
  life.ts           public API: newLife({seed, country}), advance(state, input, country) -> new state
                    (the yearly turn, design 3.2); the caller loads the country, the engine does no I/O
  person.ts, family.ts, money.ts   the newborn, parents, family ageing and deaths, household percentile
  drift.ts, mortality.ts, checks.ts   stat drift and health norm, life-table mortality and cause of death, statistical checks
  conditions.ts, events.ts   the event condition language, event schema, catalog and selection
  calibration.ts    headless harness comparing simulated life expectancy with the source (npm run calibrate)
  dist.ts           small distribution helpers (normal, clamp)
  seed.ts           readable seeds ("amber-river-4821")
  effects.ts        effects with circumstance/choice/chance tags
  stages.ts, types.ts
  world/            country schema (types.ts), validator, birth draw, data loader
src/content/        game content as data: strings (en.ts), events/ (typed event defs), names.ts (name lists by region)
src/data.ts         loads the baked country files in the browser (fetch), outside the engine
src/i18n.ts         t(key, vars) translator
src/format.ts       locale-aware numbers, money, percentages and country names (Intl)
src/ui/             React 19 components and the game store
  store.ts          holds engine state and the loaded country, exposes actions (begin, startLife, continueYear);
                    React reads it via useSyncExternalStore. World data is injected (WorldLoader), not imported
  App.tsx           switches screens by game state (no router)
  kit/              styled wrappers around React Aria Components (Button, Switch, Slider, Tooltip, Dialog)
src/styles.css      design tokens (light and dark) and shared base styles
tests/              Vitest: engine, guard and component tests
.claude/agents/     project subagents (see docs/agents.md)
.claude/skills/     project skills: vercel-react-best-practices, pre-handoff-review
e2e/                Playwright: full-loop tests at phone and desktop widths
```

- **Data flow:** the UI calls store actions, the store calls the engine (`advance`), and the engine returns a new immutable state, which React re-renders. The engine never imports from `src/ui`.
- **Determinism:** a life is fully defined by its seed, the data version, the content version and the player's decision log. Saves (M6) store those plus a snapshot, so any life can be replayed exactly.
- **Stack:** React 19 + Vite (SPA), TypeScript strict, CSS Modules, React Aria Components, Vitest, React Testing Library, Playwright, ESLint, Prettier. Hosted as a static site on GitHub Pages under `/life-simulator/`; no backend.

## Data pipeline

- `npm run data` rebuilds `public/data` and `docs/data-report.md` from `.cache/data`, downloading what is missing (`-- --refresh` downloads everything again). Behind a proxy, set `NODE_USE_ENV_PROXY=1`. Commit the regenerated files. Bump `DATA_VERSION` in `scripts/data/sources.ts` when the sources change.
- A new indicator needs: an extractor in `scripts/data/extract/`, its source in `scripts/data/sources.ts`, a field in `src/engine/world/types.ts` and the validator, and a place in the CORE or SECONDARY list in `assemble.ts`.
- `tests/data/files.test.ts` checks the committed output (schema, size, sources, estimate flags).

## Docs

Read these docs before starting work:

- `docs/features.md`: **the source of truth.** Every change traces back to a feature ID (SIM-001, UI-004, ...).
- `docs/roadmap.md`: milestones in dependency order. `docs/mvp.md`: what the MVP includes and how it is built.
- `docs/agents.md`: the project subagents, where they came from and the rules for them.
- `docs/design.md`: data model, engine rules and stack. `docs/analysis.md`: reference analysis and data sources with licences.

## How work flows

- **One thread per phase, milestone or task (Roman, 2026-10-24).** When a thread finishes its phase it stops and does not continue into the next one. It reports to the coordinator that the phase is done, with a suggested prompt that starts a new thread for the next phase or task (branch, state, blockers, feature IDs, docs to read). The coordinator starts that thread.
- **One PR per milestone** (M1, M2, ...). After MVP, one PR per feature, named by its feature ID. Roman reviews each PR before the next starts.
- **Feature loop:** for "next" or a feature ID, restate the feature, list open questions, propose the approach in a few lines, then build it. If a feature is too vague, ask instead of guessing.
- **New features** get the next free ID in their category. IDs never change and are never reused, even for dropped features.
- **Update `docs/features.md`** in the same PR: set the status (`in progress` or `done`) with the PR link. A feature is `done` only when its acceptance criteria are met; otherwise mark it `in progress` and say what is left.
- Record decisions Roman makes in the relevant doc (design decisions in `docs/design.md`, section 7 decisions log).

## Code rules

- **Engine (`src/engine/`) is pure TypeScript:** no React, no DOM, no I/O. The UI talks to it through `src/ui/store.ts`.
- **No unseeded randomness in the engine.** Never use `Math.random` or `crypto` there; draw from `stream(seed, name, year, quarter?)` in `src/engine/rng.ts`. Use a separate stream per subsystem so that new content does not shift other rolls. ESLint and a guard test enforce this.
- **One random stream per subsystem and year** (`birth`, `person`, `names`, `parents`, `family`, `drift`, `labour`, `events`, `event:<id>`, `pool:major`, `pool:minor`, `mortality`, `cause`); the `StreamName` type in `rng.ts` lists them. A new subsystem gets a new stream name.
- **Life expectancy gate:** simulated life expectancy must stay within 2 years of the source for sampled countries (`tests/engine/calibration.test.ts`). After changing mortality, hazard or drift, run `npm run calibrate -- NGA JPN IND` and keep the hazard terms centred (`HAZARD_OFFSET` in `src/engine/mortality.ts`).
- **No timers drive the game** (`setTimeout`, `setInterval`, `requestAnimationFrame` are banned in `src/`, guard test): every year waits for the player (TIME-001).
- **Never change the pinned RNG golden values** (`tests/engine/rng.test.ts`): that would change every saved life.
- **Engine state is immutable:** functions return new state and never mutate their inputs.
- **Interactive controls come from `src/ui/kit/`.** Do not import `react-aria-components` in screens, and do not use a raw `<button>`, `<input type="range">` or hand-made dialog for new UI. Style states with React Aria's data attributes (`[data-pressed]`, `[data-focus-visible]`, `[data-selected]`) in CSS Modules, using token variables only. See `docs/design-system.md`.
- **All player-facing text goes through `t(key, vars)`** with keys in `src/content/strings/en.ts`. No hard-coded strings in components or content.
- **Never invent data to get past a blocked download.** If a publisher is unreachable, say which host is blocked and carry on with the rest; do not stand in mock or made-up values. Test fixtures are synthetic and clearly marked.
- **Real data only from the primary publishers** listed in `docs/analysis.md` 1.7, with source and year on every value. Never copy text, art, code or data from the reference game (1in8b.life).
- **Sensitive content** (death, suicide, violence) is never graphic, always tagged with a sensitivity level, and followed by help resources where relevant. Suicide is never a player choice.
- **No tracking, analytics or third-party requests** (fonts included). A guard test checks for common trackers.
- **React:** function components, CSS Modules for component styles, design tokens in `src/styles.css`. Follow `.claude/skills/vercel-react-best-practices`, a client-only subset trimmed for this SPA: read its `SKILL.md` index and open only the rule files you need, never the whole `rules/` folder.
- **Accessibility is part of done:** keyboard play, visible focus, labelled controls, announcements for new events, colour never the only signal, reduced motion respected.
- Match the surrounding code: naming, comment density and idiom.

## Tests

- **Write engine tests first** (red, then green). Every engine feature has tests, including batch tests against source data where its acceptance criteria say so.
- Component tests use React Testing Library with `// @vitest-environment jsdom` at the top of the file.
- End-to-end tests in `e2e/` run with Playwright at phone (360 px) and desktop (1440 px) widths.
- Never skip, disable or loosen a test to get green.

## Before pushing

Run all of these and make sure they pass:

```sh
npm run lint
npm run format:check   # npm run format to fix
npm run typecheck
npm test
npm run e2e            # in the cloud sandbox: PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e
```

## Independent review before hand-off

Before opening a PR, and before asking Roman to review, run the `pre-handoff-review` skill (`.claude/skills/pre-handoff-review/SKILL.md`) after the checks above pass. The agent that implemented the work runs it; when a subagent such as `frontend-developer` implemented it, the caller runs it, because subagents cannot start reviewers. The hand-off includes its review summary.

## Commits and PRs

- Clear commit messages that say what changed and why.
- PR descriptions list the feature IDs delivered, the checks run, the review summary from the `pre-handoff-review` skill, and anything Roman needs to do.
