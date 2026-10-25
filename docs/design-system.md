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
| `Stepper` | `NumberField`            | Placing the yearly focus points (UI-005): arrow keys on the field, minus and plus buttons for touch, an optional description tied to the field. `compact` hides the description from sight (it still names the field) and sets the control small; `note` is a short visible line under the control that is also tied to it |
| `Tabs`, `TabPanel` | `Tabs`, `TabList`, `Tab`, `TabPanel` | The life screen's tabs (UI-004, UI-010). `variant`: `underline` (the side columns) or `bar` (the fixed bar at the bottom of a phone). The list is always rendered first, before the panels, and takes a `label`. `forceMount` on a panel keeps it in the page while it is not selected (hidden, out of reach); arrow keys, Home and End move and select |
| `Slider`  | `Slider`                 | Not used yet; kept for a later single-value setting                                      |
| `Tooltip` | `TooltipTrigger`         | Odds lens hints, if the lens ever needs them (UI-006)                                    |
| `Dialog`  | `DialogTrigger`, `Modal` | Information in a modal (UI-009)                                                          |
| `ConfirmDialog` | `DialogTrigger`, `Modal`, `Dialog` (`role="alertdialog"`) | Asks before something that cannot be undone: delete one life, delete all local data (SAVE-007). The cancel button has focus on opening, so Enter alone never confirms; confirming acts, then closes |
| `TextField` | `TextField`, `Label`, `Input`, `Text` | A labelled single-line field with a hint tied to the input (`description`): the epitaph and its characters left (DEATH-004) |

`Stepper` renders React Aria's number field, which exposes a text input with a "Number field" role description (not `role="spinbutton"`); query it by role `textbox` and its label in tests.

## Tokens worth knowing

- `--ring-study`, `--ring-work`, `--ring-love`, `--ring-loss`, `--ring-illness`, `--ring-move`, `--ring-plain`: the growth-ring colours by theme (SUM-002), each with a light and a dark value. Each is at least 3:1 against `--paper` in its theme, and the patterns are drawn in `--paper`, so they show on every ring colour. Neighbouring rings differ by hue and by pattern, never by colour alone. Use them for the rings and their legend only.

- `--invalid`: the border of a field that is not valid (dashed as well as coloured), with a lighter value in dark mode.

## Screen patterns

- **Life screen layout** (UI-004, UI-010, `src/ui/LifeScreen.tsx`): a sticky header (`LifeHeader`: wordmark, name, age and place, a settings dialog, the help link, Continue, and, on wide screens only, the Journal button and a strip of the life so far), and below it either three columns (900 px and up) or one column with a bar of tabs (below). The page scrolls as one; the side columns (`YouColumn`, `AroundColumn`, styled by `SideColumn.module.css`) are sticky, take their height from `--life-header-height` and the window, and every tab must fit a window 640 px tall (and 600 px) without scrolling: keep panels to short lines, one line a person, and put long text elsewhere. `overflow-y: auto` on a panel is the safety net, not the plan. The story is first in the page, then You, then Around you; CSS grid places them. The narrow layout is chosen by `useNarrow` (a `matchMedia` hook) and renders the three parts as force-mounted `TabPanel`s. While a decision waits, Continue stays on the page, `aria-disabled`, with the reason tied to it. The plan is a tray (`PlanWidget`): docked at the foot of the window above 1300 px wide and 700 px tall, and an ordinary block between this year and the earlier years below that (and in the narrow layout); the scroll padding in `styles.css` follows each mode. When docked it is visually last but comes before the earlier years in the tab order (it is before them in the markup), so Tab reaches the plan before the earlier-years links, by design. Sizes that depend on text are in em or rem (the side columns are `min(18rem, 28vw)`), so larger text does not push the story off the page. `LifePanels.tsx` holds the content of each tab as plain terms and lists.
- **Decision card** (UI-006, `src/ui/DecisionCardView.tsx`): a labelled region with an `h2` that takes focus when the card appears, the event text, then one `choice` button per choice. A locked choice keeps `aria-disabled` (still focusable) and its reason, cost and odds lens sit in a block tied to the button with `aria-describedby`. Odds are always words (`oddsWords` in `src/ui/words.ts`), money goes through `formatMoney`.
- **Plan widget** (UI-005, `src/ui/PlanWidget.tsx`): controlled by the life screen, which sends a plan with Continue only when the player changed it (`planToSend` in the store). Forced points and locked areas are said in words.
- **Help** (UI-012, `src/ui/HelpNote.tsx`): `HelpNote` follows any event, decision or condition with a help topic; `HelpLink` opens the directory in a new tab with `rel="noopener noreferrer"` and a screen-reader hint. The header carries an always-available "Need to talk?" link.
- **Summary** (SUM-001, `src/ui/SummaryScreen.tsx`): the h1 is the person's name and takes focus. Then the closing passage, the years against the life expectancy (DEATH-003), the rings, the key moments, what shaped the life, the life in brief, the last year's events, the epitaph and the seed. No score and no rank; lines that do not apply to a short life are left out rather than answered with "none". `EventLine` (`src/ui/EventLine.tsx`) is shared with the life screen.
- **Rings** (SUM-002, `src/ui/Rings.tsx`, geometry in `src/ui/ringsLayout.ts`): plain SVG in a 100 by 100 view box, one ring a year, the oldest innermost, each as wide as its thickness (happiness). Every theme has its own pattern as well as its colour (dots, diagonals, cross-hatch, horizontal lines, vertical lines, waves, solid), a legend names the themes that occur, and a closed `<details>` "Year by year" holds a real table with the same facts. Numbered marks sit on the years of the key moments, spread round the circle by the golden angle; a badge that has no room on a very narrow ring near the centre moves out with a line back to its ring. The numbers are the numbers of the list of moments. The rings are as wide as the square root of their thickness (so the thinnest of a hundred stay visible), and the pattern tile shrinks from 2.4 to about 0.9 view box units as the life passes 10 to 60 rings. The rings grow in with CSS only and only under `prefers-reduced-motion: no-preference` (timers are banned in `src/`).
- **Epitaph** (DEATH-004, `src/ui/Epitaph.tsx`): a `TextField` with the characters left as its description and a Save button, then the words as a blockquote with Edit. Saving is announced in a polite paragraph, and focus goes to the Edit button, never to the page.
- **Resume card** (SAVE-002, `src/ui/StartScreen.tsx`): "Continue your life" with the name, age and place, a primary Continue and a note that a new life replaces it. A save that cannot be opened is a calm `role="note"` with "Discard it".
- **Past lives** (SAVE-003, SAVE-007, `src/ui/PastLivesScreen.tsx`): a plain list (thumbnails come with UI-008); each life has Open and Delete (a `ConfirmDialog`), and "Delete all local data" has its own `ConfirmDialog` that says what goes. Focus returns to the heading when a life is deleted, because its button is gone.
- **Disclosure**: native `<details>`/`<summary>` is allowed for disclosure (the year-by-year table, how the shares are worked out), because the browser gives it the open/closed state and keyboard behaviour for free. Give it the global `disclosure` class (in `src/styles.css`) for the marker and a 2.75rem target.
- **Screens that show stored lives** (life, summary, past lives) are wrapped in `ScreenBoundary` (`src/ui/ScreenBoundary.tsx`), keyed by screen: a life saved by another version may name text this one lacks, so lines are left out with `tryT`/`hasString` rather than thrown over, and if a screen still cannot be shown it says so calmly with a Back to start button.
- **Destructive results are announced**: the past-lives screen's one `role="status"` says "The life of {name} was deleted."; after "Delete all local data" the start screen's status region says so, and its words arrive after the region is on the page (`useDeferredValue` with an empty first value).
- **Notes about storage**: a save that fails mid-life, or an archive that cannot keep a life, is said in a `role="note"` inside an `aria-live="polite"` container that is on the page before the words arrive, so it is announced once; notes about a resumed life are plain `role="note"`.
- **One live region** (`role="status"`) per life screen holds the story; new status-like text elsewhere uses `aria-live="polite"` on a paragraph instead of a second status region.
- `.eyebrow` (in `src/styles.css`) is the small uppercase label above a section; a screen's module sets its own margin.
- `.visually-hidden` (in `src/styles.css`) is for text only screen readers need.

## Rules for adding or changing a component

- Style states with data attributes: `[data-pressed]`, `[data-hovered]`, `[data-focus-visible]`, `[data-selected]`, `[data-disabled]`.
- Keep a 2.75rem minimum touch target and the shared `--focus` ring.
- Respect `prefers-reduced-motion`.
- Add a test in `tests/ui/kit.test.tsx` that uses the keyboard, not only the mouse.
- Import React Aria sub-paths by named import from `react-aria-components` inside the kit only, to keep bundles tree-shakeable.
