---
title: Deduplicate Global Event Listeners
impact: LOW
impactDescription: single listener for N components
tags: client, event-listeners, subscription
---

## Deduplicate Global Event Listeners

Register one global listener and share it across component instances through a module-level registry.

**Incorrect (N instances = N listeners):**

```tsx
function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === key) {
        callback()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, callback])
}
```

When using the `useKeyboardShortcut` hook multiple times, each instance will register a new listener.

**Correct (N instances = 1 listener):**

```tsx
// Module-level Map to track callbacks per key
// Arrays, not Sets, so two hook instances passing the same callback each keep their own entry
const keyCallbacks = new Map<string, Array<() => void>>()

function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey) [...(keyCallbacks.get(e.key) ?? [])].forEach(cb => cb())
}

function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    // The first registered callback attaches the single shared listener
    if (keyCallbacks.size === 0) window.addEventListener('keydown', onKeyDown)
    if (!keyCallbacks.has(key)) keyCallbacks.set(key, [])
    keyCallbacks.get(key)!.push(callback)

    return () => {
      const list = keyCallbacks.get(key)!
      list.splice(list.indexOf(callback), 1)
      if (list.length === 0) keyCallbacks.delete(key)
      // The last callback to leave removes it
      if (keyCallbacks.size === 0) window.removeEventListener('keydown', onKeyDown)
    }
  }, [key, callback])
}

function Profile() {
  // Multiple shortcuts will share the same listener
  useKeyboardShortcut('p', () => { /* ... */ }) 
  useKeyboardShortcut('k', () => { /* ... */ })
  // ...
}
```
