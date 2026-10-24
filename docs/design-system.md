# Design system

Birthright uses **React Aria Components** (Adobe, Apache-2.0) for the behaviour and accessibility of interactive controls, and our own **CSS Modules and tokens** for every pixel of the look. Chosen by Roman on 2026-10-24 after comparing React UI libraries (shadcn/ui, MUI, Mantine, Radix, Base UI and others). CSS Modules was kept over Tailwind because React Aria exposes state as data attributes that read naturally as plain CSS selectors, and our light and dark themes already live in CSS variables.

## Layers

1. **Tokens** (`src/styles.css`): colours, type, spacing, radius, focus ring, light and dark themes. Components use these variables and never raw colours or sizes.
2. **Kit** (`src/ui/kit/`): thin wrappers around React Aria Components with our styles. Screens import only from `src/ui/kit`.
3. **Screens** (`src/ui/*.tsx`): compose kit components and custom SVG. Text comes from `t(key)`; kit components take already-translated strings as props.

## Kit components

| Component | Wraps                   | Planned use                                          |
| --------- | ----------------------- | ---------------------------------------------------- |
| `Button`  | `Button`                | All actions. `variant`: `primary` or `ghost`; `icon` |
| `Switch`  | `Switch`                | Settings toggles: softening, reduced motion (UI-009); US-prices line (MONEY-007) |
| `Slider`  | `Slider`                | Focus-point allocator (UI-005)                       |
| `Tooltip` | `TooltipTrigger`        | Odds lens (UI-006)                                   |
| `Dialog`  | `DialogTrigger`, `Modal`| Help resources, confirmations (UI-012, UI-009)       |

Decision cards (UI-006) will use React Aria `RadioGroup` or `ListBox`; add a kit wrapper when that screen is built.

## Rules for adding or changing a component

- Style states with data attributes: `[data-pressed]`, `[data-hovered]`, `[data-focus-visible]`, `[data-selected]`, `[data-disabled]`.
- Keep a 2.75rem minimum touch target and the shared `--focus` ring.
- Respect `prefers-reduced-motion`.
- Add a test in `tests/ui/kit.test.tsx` that uses the keyboard, not only the mouse.
- Import React Aria sub-paths by named import from `react-aria-components` inside the kit only, to keep bundles tree-shakeable.
