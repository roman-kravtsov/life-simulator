---
name: vercel-react-best-practices
description: Client-side React performance rules (bundle size, re-renders, rendering, JavaScript hot paths, browser storage) from Vercel Engineering, trimmed for a Vite single-page app. Use when writing, reviewing or refactoring React components, lazy loading or event listeners.
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---

# React best practices (client-side subset)

Birthright is a client-only React 19 + Vite SPA: no server, no Next.js, no RSC, no SWR. Only rules that apply to that are kept (see `SOURCE.md`).

## How to use

This index is all that loads by default. Pick the rules that match the code you are touching, then read only those files, e.g. `rules/bundle-barrel-imports.md`. Do not read the whole `rules/` folder. Each file has a short why, an incorrect and a correct example.

## Async

- `async-defer-await`: Defer Await Until Needed
- `async-parallel`: Promise.all() for Independent Operations

## Bundle size

- `bundle-analyzable-paths`: Prefer Statically Analyzable Import Paths
- `bundle-barrel-imports`: Avoid Barrel File Imports
- `bundle-conditional`: Conditional Module Loading
- `bundle-dynamic-imports`: Dynamic Imports for Heavy Components
- `bundle-preload`: Preload Based on User Intent

## Browser APIs and listeners

- `client-event-listeners`: Deduplicate Global Event Listeners
- `client-localstorage-schema`: Version and Minimize localStorage Data
- `client-passive-event-listeners`: Use Passive Event Listeners for Scrolling Performance

## Re-renders

- `rerender-defer-reads`: Defer State Reads to Usage Point
- `rerender-dependencies`: Narrow Effect Dependencies
- `rerender-derived-state`: Subscribe to Derived State
- `rerender-derived-state-no-effect`: Calculate Derived State During Rendering
- `rerender-functional-setstate`: Use Functional setState Updates
- `rerender-lazy-state-init`: Use Lazy State Initialization
- `rerender-memo`: Extract to Memoized Components
- `rerender-memo-with-default-value`: Extract Default Non-primitive Parameter Value from Memoized Component to Constant
- `rerender-move-effect-to-event`: Put Interaction Logic in Event Handlers
- `rerender-no-inline-components`: Don't Define Components Inside Components
- `rerender-simple-expression-in-memo`: Do not wrap a simple expression with a primitive result type in useMemo
- `rerender-split-combined-hooks`: Split Combined Hook Computations
- `rerender-transitions`: Use Transitions for Non-Urgent Updates
- `rerender-use-deferred-value`: Use useDeferredValue for Expensive Derived Renders
- `rerender-use-ref-transient-values`: Use useRef for Transient Values

## Rendering

- `rendering-animate-svg-wrapper`: Animate SVG Wrapper Instead of SVG Element
- `rendering-conditional-render`: Use Explicit Conditional Rendering
- `rendering-content-visibility`: CSS content-visibility for Long Lists
- `rendering-hoist-jsx`: Hoist Static JSX Elements
- `rendering-svg-precision`: Optimize SVG Precision
- `rendering-usetransition-loading`: Use useTransition Over Manual Loading States

## JavaScript

- `js-batch-dom-css`: Avoid Layout Thrashing
- `js-cache-function-results`: Cache Repeated Function Calls
- `js-cache-property-access`: Cache Property Access in Loops
- `js-cache-storage`: Cache Storage API Calls
- `js-combine-iterations`: Combine Multiple Array Iterations
- `js-early-exit`: Early Return from Functions
- `js-flatmap-filter`: Use flatMap to Map and Filter in One Pass
- `js-hoist-regexp`: Hoist RegExp Creation
- `js-index-maps`: Build Index Maps for Repeated Lookups
- `js-length-check-first`: Early Length Check for Array Comparisons
- `js-min-max-loop`: Use Loop for Min/Max Instead of Sort
- `js-request-idle-callback`: Defer Non-Critical Work with requestIdleCallback
- `js-set-map-lookups`: Use Set/Map for O(1) Lookups
- `js-tosorted-immutable`: Use toSorted() Instead of sort() for Immutability

## Advanced

- `advanced-effect-event-deps`: Do Not Put Effect Events in Dependency Arrays
- `advanced-event-handler-refs`: Store Event Handlers in Refs
- `advanced-init-once`: Initialize App Once, Not Per Mount
- `advanced-use-latest`: useEffectEvent for Stable Callback Refs
