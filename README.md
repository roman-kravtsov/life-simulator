# Birthright: a life simulation

Be born somewhere in the world, by the real odds of birth today, and live one life to its end. A browser game built on public statistics (UN, World Bank, WHO and others). Free and non-commercial.

## Play

The game is a static site: <https://roman-kravtsov.github.io/life-simulator/> (every merge to `main` deploys it to GitHub Pages). Everything runs in your browser and is saved there; nothing is sent anywhere.

## Develop

```sh
npm install
npm run dev        # local dev server
npm test           # engine, guard and component tests
npm run e2e        # Playwright, phone and desktop widths (builds first)
npm run typecheck
npm run build      # production build in dist/
npm run data       # rebuild public/data from the source publishers (see CLAUDE.md)
npm run calibrate -- NGA JPN   # compare simulated life expectancy with the source
```

## Docs

- `docs/analysis.md`: analysis of the reference game and data sources
- `docs/design.md`: identity, data model and simulation engine
- `docs/features.md`: feature inventory, the source of truth for all work
- `docs/roadmap.md`: milestones
- `docs/mvp.md`: MVP definition

## Layout

```
src/engine/   pure simulation, no DOM (seeded RNG, life, stages, effects)
src/content/  text and game content
src/ui/       screens and DOM helpers
tests/        Vitest tests
```
