# Birthright: working conventions

## The game

Birthright is a browser game in which the player lives one person's life from birth to death. The birthplace, family and household wealth are drawn by the odds of birth today, as far as public statistics reach, using public statistics from the UN, World Bank, WHO and others. Each year the player spends a few focus points (Learn, Earn, Health, Belonging, Rest) and faces events and decisions, and the outcomes are shaped by real data on schooling, work, income, marriage, illness and death in that country. Choices shift the odds but never escape them, and an "odds lens" shows by how much. The tone is reflective and literary, hard topics are handled honestly but never graphically, and at the end the life is shown as tree rings with a summary of what came from chance, choice and circumstance. It is free, non-commercial, runs entirely in the browser and saves locally.

The visible stats are Health, Happiness, Belonging and Skills (ids `health`, `happiness`, `belonging`, `skills`). The yearly focus areas are Learn, Earn, Health, Belonging and Rest (ids `learn`, `earn`, `health`, `belonging`, `rest`, Roman 2026-10-24). Belonging is both a stat and a focus area: the Belonging focus raises the Belonging stat, and the context says which is meant. Never call the focus area "Bond" (nor stat or focus "bonds"): Belonging is the domain name. Use these names everywhere.

## Keeping these conventions

- **Follow every rule in this file on every change**, in every session. If a rule seems wrong for a task, ask Roman instead of quietly breaking it.
- **Keep this file current.** When a change alters the architecture, a convention, the stack or a check, update `CLAUDE.md` in the same PR. When Roman sets a new rule, add it here.
- **Rules are enforced by tooling where possible** (ESLint, guard tests in `tests/guards.test.ts`, CI). When a convention can be checked automatically, add a check instead of relying on memory.

## Architecture

```
public/data/        baked country data (index.json + countries/<ISO3>.json), built by `npm run data`
scripts/            calibrate.ts (`npm run calibrate`), probe.ts (`npm run probe` writes docs/agency-probe.md), balance-report.ts (`npm run balance-report` writes docs/balance-report.md)
scripts/data/       data pipeline: lib/ (cache, csv), extract/ (one file per publisher), assemble.ts
                    (completeness filter and fallbacks), sources.ts (licences), build.ts, report.ts
                    Downloads go to the git-ignored .cache/data; the exclusion report, with the excluded countries' share of births, is docs/data-report.md
src/engine/         pure TypeScript simulation: no React, no DOM, no I/O
  rng.ts            seeded PRNG and independent streams per subsystem and period
  life.ts           public API: newLife({seed, country, settings?}), advance(state, input, country) -> new state
                    (the yearly turn, design 3.2: `continue` may stop at `state.turn` for a decision and `choose` answers it),
                    advanceAuto (default course at every decision), decisionCard, withSettings; the caller loads the country,
                    the engine does no I/O
  person.ts, family.ts, money.ts   the newborn, parents and siblings, family ageing and deaths, household and adult percentile, income, savings and debt
  education.ts, work.ts   school levels and literacy, participation, sectors and informal work, retirement (each calibrated per country)
  health.ts, relationships.ts   condition rules (onset, progression, hazard) and relationship closeness; the conditions themselves are content
  drift.ts, mortality.ts, checks.ts   stat drift and health norm, life-table mortality and cause of death, statistical checks
  conditions.ts, events.ts   the event condition language, event schema, catalog and selection (pools, pacing, roles, softening)
  focus.ts          the yearly plan: five focus areas, three points, diminishing returns, points taken by circumstance
  decisions.ts      choices with outcomes, locks, costs and the odds lens; systemDecisions.ts is the engine's own (school, care, partners)
  partnership.ts    marriage-age model, courtship, arranged marriage under 18, fertility
  death.ts          the death record, cause groups, closing passage keys and the comparison with life expectancy (DEATH-001 to 003)
  summary.ts, rings.ts   the finished life as data: facts, growth rings and their themes, key moments, chance/choice/circumstance shares
  reflection.ts     reflection prompts (a pure function of the years lived, from content/reflections.ts) and the journal lines (UI-007)
  save.ts, replay.ts   the save file, schema migrations, restoring a life (snapshot, or replay from seed and logs), replay (RNG-004), the export file and its import (`exportText`, `parseImport`, `resave`, SAVE-006)
  validate.ts       content validation (ADMIN-001): validateEvents, validateConditions, run over what ships in the tests
  calibration.ts    headless harness comparing simulated life expectancy, the school, work, family and income systems and the causes of death with the source (npm run calibrate)
  probe.ts          the agency probe (ADMIN-005): plays lives under each plan and each answer to each decision, paired against the default course, and holds the balance targets (`balanceChecks`); probeReport.ts and balanceReport.ts render the Markdown reports
  dist.ts           small distribution helpers (normal, clamp)
  names.ts          distinct names (CHAR-007): `pickName` takes the rolled name or the next free one, `takenNames` and `reservedNames` say which are taken
  seed.ts           readable seeds ("amber-river-4821")
  effects.ts        effects with circumstance/choice/chance tags
  stages.ts, types.ts
  world/            country schema (types.ts), validator, birth draw, data loader, excluded.ts (the births in the countries left out, for the sources screen and the data report)
src/content/        game content as data: strings (en.ts merges strings/systems.ts, strings/death.ts, strings/summary.ts, strings/reflection.ts, strings/events/*.ts and strings/ui.ts),
                    version.ts (CONTENT_VERSION, saved with every life),
                    events/ (typed event defs, one file per life stage, helpers.ts), healthConditions.ts, names.ts (name lists by region),
                    reflections.ts (the reflection prompts and what triggers each)
src/data.ts         loads the baked country files in the browser (fetch), outside the engine
src/save/           browser storage outside the engine: current.ts (the life in progress, localStorage `birthright:current`), archive.ts (finished lives, IndexedDB via idb), file.ts (a life as a file the player downloads or loads, SAVE-006),
                    index.ts (the Persistence interface the store uses, browserPersistence, noPersistence)
src/i18n.ts         t(key, vars) translator
src/format.ts       locale-aware numbers, money, percentages and country names (Intl)
src/ui/             React 19 components and the game store
  store.ts          holds engine state and the loaded country, exposes actions (begin, endReveal, startLife, continueYear, choose, setSettings, toggleUsPrices, writeJournal, openSettings, plus resume, epitaph, past lives, and exportCurrent, exportPastLife and importLife for saving a life to a file and loading one, SAVE-006);
                    autosaves after every turn and archives a life when it ends;
                    React reads it via useSyncExternalStore. World data is injected (WorldLoader), not imported
  App.tsx           switches screens by game state (no router)
  reveal.ts, RevealScreen.tsx   the birth reveal (UI-016) between Begin and the birth screen: `reveal.ts` is pure (the passing countries drawn by births from the `reveal` stream, the pace, the "1 in N"), the screen is timed in CSS alone (no timers: each name has an `animation-delay`, the last, invisible animation ends it), `aria-hidden` reel, Skip (reads Continue if the reel ends while focus is in the header) and Escape, no reel under reduced motion (the birth screen adds a line about chance), and a still name with Back to start while the country is still loading
  hints.ts, Hint.tsx, HintSettings.tsx   first-life hints (UI-015): `hints.ts` keeps which of the three (`plan`, `decision`, `lens`) were seen under `birthright:hints`, outside any save, `Hint.tsx` is the plain note with Got it (no timers or announcements, the caller moves focus), `HintSettings.tsx` brings them back on the settings screen; the life screen shows them, App passes the store and resets it on delete all
  Page.tsx          the shell every screen renders through: the header outside `<main id="content">`, `data-layout` reading or wide; SiteHeader.tsx is the header of every screen but the life screen
  LifeFiles.tsx     saving a life to a file and loading one (SAVE-006), on the settings and past lives screens
  SettingsScreen.tsx, DisplaySettings.tsx, DeleteAllData.tsx   the settings screen (UI-009); display.ts keeps theme, text size and reduced motion on `<html>` (`birthright:theme`, `birthright:text-size`, `birthright:motion`), outside any save
  LifeScreen.tsx    the life screen (UI-004, UI-010), composed of LifeHeader.tsx (sticky header, strip, settings dialog, Continue), Ledger.tsx (the years) with PlanWidget.tsx (the plan tray),
                    Journal.tsx (the reflection prompt, the Notes tab and the notes on the summary), YouColumn.tsx and AroundColumn.tsx (sticky side columns of tabs, styled by SideColumn.module.css; their panels are in LifePanels.tsx, the rings thumbnail is RingsThumb.tsx),
                    useNarrow.ts (matchMedia: below 900 px one column and a bar of tabs); the store derives lifeStrip, lifeRings, statBand, countryFacts
  kit/              styled wrappers around React Aria Components (Button, Switch, Stepper, Slider, Tooltip, Dialog, ConfirmDialog, FileButton, TextField, Tabs, RadioGroup)
src/styles.css      design tokens (light and dark), shared base styles, and the one global rule set for reduced motion and text size
index.html          mounts the app on `<div id="root">` (the page owns its own `<main>`)
tests/              Vitest: engine, guard and component tests; tests/fixtures/saves holds two frozen schema 1 save files that must keep loading (TD-002)
.claude/agents/     project subagents (see docs/agents.md)
.claude/skills/     project skills: vercel-react-best-practices, pre-handoff-review, new-event, milestone-handoff
.github/            CI, deploy and balance (probe and balance report as an artifact) workflows, dependabot.yml (weekly, grouped npm updates), pull_request_template.md
e2e/                Playwright: full-loop tests at phone and desktop widths; keyboard.spec.ts plays a whole life with the keyboard only (A11Y-001); axe.spec.ts runs axe-core over every screen, side tab and dialog in both themes (A11Y-006); files.spec.ts saves a life to a file, empties the browser and loads it back (SAVE-006)
```

- **Data flow:** the UI calls store actions, the store calls the engine (`advance`), and the engine returns a new immutable state, which React re-renders. The engine never imports from `src/ui`.
- **Determinism:** a life is fully defined by its seed, the data version, the content version and the player's decision, plan and settings logs. Saves store those plus a snapshot (a cache), so any life can be replayed exactly (`replay`, tested over many random lives). Design 2.4 has the format.
- **Stack:** React 19 + Vite (SPA), TypeScript strict, CSS Modules, React Aria Components, `idb` (IndexedDB), Vitest, React Testing Library, `fake-indexeddb` (tests), Playwright, ESLint, Prettier. Node 22.22.2 or newer (jsdom 30 needs it; CI uses Node 22). Hosted as a static site on GitHub Pages under `/life-simulator/`; no backend.

## Data pipeline

- `npm run data` rebuilds `public/data` and `docs/data-report.md` from `.cache/data`, downloading what is missing (`-- --refresh` downloads everything again). Behind a proxy, set `NODE_USE_ENV_PROXY=1`. Commit the regenerated files. Bump `DATA_VERSION` in `scripts/data/sources.ts` when the sources change.
- A new indicator needs: an extractor in `scripts/data/extract/`, its source in `scripts/data/sources.ts`, a field in `src/engine/world/types.ts` and the validator, and a place in the CORE or SECONDARY list in `assemble.ts`.
- `tests/data/files.test.ts` checks the committed output (schema, size, sources, estimate flags).

## Docs

Read these docs before starting work:

- `ROADMAP.md`: **the living plan**: status, the MVP boundary, phases, priorities, technical debt and open decisions. Read it first and check it against the code.
- `docs/features.md`: **the source of truth.** Every change traces back to a feature ID (SIM-001, UI-004, ...).
- `docs/roadmap.md`: the original milestone map of all features (M1 to M7 are history; `ROADMAP.md` regroups what is left). `docs/mvp.md`: what the MVP includes and how it is built.
- `docs/agents.md`: the project subagents, where they came from and the rules for them.
- `docs/design.md`: data model, engine rules and stack. `docs/analysis.md`: reference analysis and data sources with licences.

## How work flows

- **One thread per phase, milestone or task (Roman, 2026-10-24).** When a thread finishes its phase it stops and does not continue into the next one. It reports to the coordinator that the phase is done, with a suggested prompt that starts a new thread for the next phase or task (branch, state, blockers, feature IDs, docs to read). The coordinator starts that thread.
- **One PR per milestone** (M1, M2, ...). After MVP, one PR per feature, named by its feature ID. Roman reviews each PR before the next starts.
- **Feature loop:** for "next" or a feature ID, restate the feature, list open questions, propose the approach in a few lines, then build it. If a feature is too vague, ask instead of guessing.
- **New features** get the next free ID in their category. IDs never change and are never reused, even for dropped features.
- **Keeping the roadmap current (Roman, 2026-10-26).** `ROADMAP.md` is the one active plan. In the same PR as any work that finishes, starts or drops something, changes the MVP scope, a priority or a decision, or adds a system, update its status markers, "Next up", "Open decisions", technical debt and change log. Before substantial work, check it against the code; if they disagree, reconcile them in that PR and say so in the change log, never follow an outdated roadmap. A significant scope change records what changed, why, what it affects and what follows. Per-feature status stays in `docs/features.md` (do not copy it into the roadmap); design decisions stay in `docs/design.md` section 7. Do not start implementation on the strength of the roadmap alone: Roman asks for it.
- **Update `docs/features.md`** in the same PR: set the status (`in progress` or `done`) with the PR link. A feature is `done` only when its acceptance criteria are met; otherwise mark it `in progress` and say what is left.
- Record decisions Roman makes in the relevant doc (design decisions in `docs/design.md`, section 7 decisions log).
- **Agents and skills for the work** (`docs/agents.md`): `frontend-developer` for `src/ui`, `engine-developer` for `src/engine`, the `new-event` skill for events and decisions in `src/content`. When a phase is finished, use the `milestone-handoff` skill for the report to the coordinator.

## Code rules

- **Dependencies stay on the latest version their peers allow.** TypeScript is held at 6.0 (`~6.0.3`) because `typescript-eslint` declares `typescript <6.1.0`; move to TypeScript 7 only when `typescript-eslint` supports it. `@types/node` stays on 22 to match the Node version CI and the sandbox run. `.github/dependabot.yml` ignores those two major bumps; remove the ignore when the reason goes away. A dependency update that touches the engine, replay or saves must say so in its PR.
- **Engine (`src/engine/`) is pure TypeScript:** no React, no DOM, no I/O. The UI talks to it through `src/ui/store.ts`.
- **No unseeded randomness in the engine.** Never use `Math.random` or `crypto` there; draw from `stream(seed, name, year, quarter?)` in `src/engine/rng.ts`. Use a separate stream per subsystem so that new content does not shift other rolls. ESLint and a guard test enforce this.
- **One random stream per subsystem and year** (`birth`, `person`, `names`, `parents`, `siblings`, `siblings:birth`, `family`, `closeness`, `drift`, `labour`, `education`, `work`, `money`, `events`, `event:<id>`, `pool:major`, `pool:minor`, `condition:<id>`, `care`, `friends`, `romance`, `fertility`, `outcomes`, `mortality`, `cause`, `reveal`, `autoplay`); the `StreamName` type in `rng.ts` lists them. A new subsystem gets a new stream name.
- **Events and decisions are content** (`src/content/events/<stage>.ts`, strings in `src/content/strings/events/`). `tests/engine/validate.test.ts` runs `validateEvents` over everything that ships: text, soft text, note, choice, outcome, lens and lock keys must exist, outcome probabilities must sum to 1, a choice with several outcomes needs a lens phrase for each, severe and difficult events need a `helpTopic` and a `softText`, `world` paths must resolve, and roles, follow-ups and illness ids must exist. A repeatable notable event needs `cooldownYears` of at least 6 unless it is `quiet` or `once` (`tests/engine/content.test.ts`, which also holds the size and pacing targets). Text may only name the event's roles (`{friend}`). One decision a year at most; the odds lens reads the engine's own probabilities, never a separate number.
- **Names are distinct (CHAR-007).** Every new person in a life (a sibling, friend, partner or child) takes a name through `pickName(list, roll, takenNames(person, reservedNames(pending)))` in `src/engine/names.ts`: the one roll already drawn, skipping the person and the living relatives, never a second draw. `tests/engine/distinctNames.test.ts` checks it over many lives.
- **Balance gate (ADMIN-005):** the targets in `balanceChecks` (`src/engine/probe.ts`) hold over 400 lives in `tests/engine/balance.test.ts`: each focus area pays in its own domain, Earn shows in the income rank, no single point beats another on every outcome, and the default course credits 10% to 15% to choice (part of the default plan counts as choice, `DEFAULT_PLAN_CREDIT`) while a deliberate plan credits clearly more. After changing `FOCUS_EFFECT`, the money mix, drift, a summary share or the plan, run `npm run probe` and commit the regenerated `docs/agency-probe.md`; after changing mortality, conditions, education, work or family models, run `npm run balance-report` and commit `docs/balance-report.md`. A threshold is Roman's call: do not move one to get green.
- **Life expectancy gate:** simulated life expectancy must stay within 2 years of the source for sampled countries (`tests/engine/calibration.test.ts`). After changing mortality, hazard, drift or conditions, run `npm run calibrate -- NGA JPN IND` and keep the hazard terms centred (`HAZARD_OFFSET` in `src/engine/mortality.ts`; conditions are centred by `expectedHazardFactor`). The same command also compares school completion, literacy, labour participation, sector and informal shares, the share out of work, marriage ages, children per woman, siblings and schooling persistence with the source (`calibrateSystems`, gated in `tests/engine/calibration.test.ts`).
- **Reduced motion is one global rule set in `src/styles.css`** (the system's `prefers-reduced-motion` and the player's setting); a component or module must not write its own `prefers-reduced-motion` query (`tests/ui/styles.test.ts`). Colours must pass WCAG AA (`tests/ui/contrast.test.ts` reads every colour a style sheet sets for text).
- **No timers drive the game** (`setTimeout`, `setInterval`, `requestAnimationFrame` are banned in `src/`, guard test): every year waits for the player (TIME-001).
- **Bump `CONTENT_VERSION`** (`src/content/version.ts`) when a change to events or conditions could make a logged life play differently; a test pins a fingerprint of the catalog and fails until you do. A new `LifeState` or `SaveFile` field needs `readSave`/`MIGRATIONS` thought: a save of the old shape must still load (a test pins the shape of `LifeState` and `SaveFile` and fails until you update it). Follow "Changing the schema" in `docs/design.md` 2.4: bump `SCHEMA_VERSION`, write a pure migration that upgrades the snapshot in place, and keep the frozen files in `tests/fixtures/saves` unchanged; add one written by the previous version. Exported files are saves, so they carry the same promise.
- **Browser storage:** every localStorage key starts with `birthright:` (a guard test), so "delete all local data" can find it. Storage can be missing or full: never let a read or write throw into the UI.
- **Never change the pinned RNG golden values** (`tests/engine/rng.test.ts`): that would change every saved life.
- **Engine state is immutable:** functions return new state and never mutate their inputs.
- **Interactive controls come from `src/ui/kit/`.** Do not import `react-aria-components` in screens, and do not use a raw `<button>`, `<input type="range">` or hand-made dialog for new UI. Style states with React Aria's data attributes (`[data-pressed]`, `[data-focus-visible]`, `[data-selected]`) in CSS Modules, using token variables only. See `docs/design-system.md`.
- **All player-facing text goes through `t(key, vars)`** with keys in `src/content/strings/en.ts`. No hard-coded strings in components or content.
- **Never invent data to get past a blocked download.** If a publisher is unreachable, say which host is blocked and carry on with the rest; do not stand in mock or made-up values. Test fixtures are synthetic and clearly marked.
- **Real data only from the primary publishers** listed in `docs/analysis.md` 1.7, with source and year on every value. Never copy text, art, code or data from the reference game (1in8b.life).
- **Sensitive content** (death, suicide, violence) is never graphic, always tagged with a sensitivity level, and followed by help resources where relevant. Suicide is never a player choice.
- **No tracking, analytics or third-party requests** (fonts included). A guard test checks for common trackers.
- **React:** function components, CSS Modules for component styles, design tokens in `src/styles.css`. Follow `.claude/skills/vercel-react-best-practices`, a client-only subset trimmed for this SPA: read its `SKILL.md` index and open only the rule files you need, never the whole `rules/` folder.
- **The life screen scrolls as one page, and its side columns are sticky and must fit a window 640 px tall** (and 600 px) without scrolling in every tab; `e2e/loop.spec.ts` checks this at the default text size (at the larger text sizes a panel may scroll inside itself, design 7). Keep panels to short lines. The narrow layout (below 900 px) is one column with a bar of tabs; the smallest phone is about 390 px, so test at about 400 px; 360 px is not supported.
- **A new screen, tab or dialog goes into `e2e/axe.spec.ts`** (A11Y-006), which must stay free of axe violations at both widths and in both themes. Axe finds what a machine can; it does not replace a screen reader pass.
- **Accessibility is part of done:** keyboard play, visible focus, labelled controls, announcements for new events, colour never the only signal, reduced motion respected.
- Match the surrounding code: naming, comment density and idiom.

## Tests

- **Write engine tests first** (red, then green). Every engine feature has tests, including batch tests against source data where its acceptance criteria say so.
- Component tests use React Testing Library with `// @vitest-environment jsdom` at the top of the file.
- End-to-end tests in `e2e/` run with Playwright at phone (about 400 px, the smallest phone is 390 to 430 px) and desktop (1440 px) widths.
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

Before opening a PR, and before asking Roman to review, run the `pre-handoff-review` skill (`.claude/skills/pre-handoff-review/SKILL.md`) after the checks above pass. The agent that implemented the work runs it; when a subagent such as `frontend-developer` implemented it, the caller runs it, because subagents cannot start reviewers. The hand-off includes its review summary. When anything under `src/content` changed, the skill also runs the `content-reviewer` agent.

## Commits and PRs

- Clear commit messages that say what changed and why.
- PR descriptions follow `.github/pull_request_template.md`: they list the feature IDs delivered, the checks run, the review summary from the `pre-handoff-review` skill, and anything Roman needs to do.
