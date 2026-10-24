---
title: Prefer Statically Analyzable Import Paths
impact: HIGH
impactDescription: avoids accidental broad bundles
tags: bundle, vite, rollup, dynamic-import, path
---

## Prefer Statically Analyzable Import Paths

Bundlers (Vite, Rollup) work best when import paths are obvious at build time. If the real path hides in a variable, the bundler either includes a broad set of possible files, warns that it cannot analyze the import, or leaves the import unresolved.

Prefer an explicit map of literal imports so the set of reachable modules stays narrow and predictable.

**Incorrect (the bundler cannot tell what may be imported):**

```ts
const Page = await import(`./pages/${pageName}`)
```

**Correct (use an explicit map of allowed modules):**

```ts
const PAGE_MODULES = {
  home: () => import('./pages/home'),
  settings: () => import('./pages/settings'),
} as const

const Page = await PAGE_MODULES[pageName]()
```

Reference: [Vite features](https://vite.dev/guide/features.html), [Rollup dynamic import vars](https://www.npmjs.com/package/@rollup/plugin-dynamic-import-vars)
