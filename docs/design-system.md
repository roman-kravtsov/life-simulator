# Design system

Birthright uses **React Aria Components** (Adobe, Apache-2.0) for the behaviour and accessibility of interactive controls, and our own **CSS Modules and tokens** for every pixel of the look. Chosen by Roman on 2026-10-24 after comparing React UI libraries (shadcn/ui, MUI, Mantine, Radix, Base UI and others). CSS Modules was kept over Tailwind because React Aria exposes state as data attributes that read naturally as plain CSS selectors, and our light and dark themes already live in CSS variables.

## Layers

1. **Tokens** (`src/styles.css`): colours, type, spacing, radius, focus ring, light and dark themes. Components use these variables and never raw colours or sizes.
2. **Kit** (`src/ui/kit/`): thin wrappers around React Aria Components with our styles. Screens import only from `src/ui/kit`.
3. **Screens** (`src/ui/*.tsx`): compose kit components and custom SVG. Text comes from `t(key)`; kit components take already-translated strings as props.

## Kit components

| Component | Wraps                    | Use                                                                                     |
| --------- | ------------------------ | --------------------------------------------------------------------------------------- |
| `Button`  | `Button`                 | All actions. `variant`: `primary`, `ghost` or `choice` (a full-width answer on a decision card; `aria-disabled` shows dashed); `icon` |
| `Switch`  | `Switch`                 | Settings: softer telling and skip quiet years (EVENT-006, TIME-002); US-prices line (MONEY-007) |
| `Stepper` | `NumberField`            | Placing the yearly focus points (UI-005): arrow keys on the field, minus and plus buttons for touch, an optional description tied to the field |
| `Slider`  | `Slider`                 | Not used yet; kept for a later single-value setting                                      |
| `Tooltip` | `TooltipTrigger`         | Odds lens hints, if the lens ever needs them (UI-006)                                    |
| `Dialog`  | `DialogTrigger`, `Modal` | Confirmations (UI-009)                                                                   |

`Stepper` renders React Aria's number field, which exposes a text input with a "Number field" role description (not `role="spinbutton"`); query it by role `textbox` and its label in tests.

## Screen patterns

- **Decision card** (UI-006, `src/ui/DecisionCardView.tsx`): a labelled region with an `h2` that takes focus when the card appears, the event text, then one `choice` button per choice. A locked choice keeps `aria-disabled` (still focusable) and its reason, cost and odds lens sit in a block tied to the button with `aria-describedby`. Odds are always words (`oddsWords` in `src/ui/words.ts`), money goes through `formatMoney`.
- **Plan widget** (UI-005, `src/ui/PlanWidget.tsx`): controlled by the life screen, which sends a plan with Continue only when the player changed it (`planToSend` in the store). Forced points and locked areas are said in words.
- **Help** (UI-012, `src/ui/HelpNote.tsx`): `HelpNote` follows any event, decision or condition with a help topic; `HelpLink` opens the directory in a new tab with `rel="noopener noreferrer"` and a screen-reader hint. The header carries an always-available "Need to talk?" link.
- **One live region** (`role="status"`) per life screen holds the story; new status-like text elsewhere uses `aria-live="polite"` on a paragraph instead of a second status region.
- `.eyebrow` (in `src/styles.css`) is the small uppercase label above a section; a screen's module sets its own margin.
- `.visually-hidden` (in `src/styles.css`) is for text only screen readers need.

## Rules for adding or changing a component

- Style states with data attributes: `[data-pressed]`, `[data-hovered]`, `[data-focus-visible]`, `[data-selected]`, `[data-disabled]`.
- Keep a 2.75rem minimum touch target and the shared `--focus` ring.
- Respect `prefers-reduced-motion`.
- Add a test in `tests/ui/kit.test.tsx` that uses the keyboard, not only the mouse.
- Import React Aria sub-paths by named import from `react-aria-components` inside the kit only, to keep bundles tree-shakeable.
