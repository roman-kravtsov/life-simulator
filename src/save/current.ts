// The life in progress, in localStorage (SAVE-001, SAVE-002). Small, and read once when the game opens.
export const CURRENT_KEY = "birthright:current";

/** Every key the game writes begins with this, so deleting all local data can find them (SAVE-007). */
export const KEY_PREFIX = "birthright:";

export type CurrentLife = { status: "none" } | { status: "found"; raw: unknown } | { status: "unreadable" };

/** What is stored for the life in progress. Storage can be missing or full, so every access is guarded. */
export function loadCurrent(storage?: Storage): CurrentLife {
  try {
    storage ??= localStorage;
    const text = storage.getItem(CURRENT_KEY);
    if (text === null) return { status: "none" };
    return { status: "found", raw: JSON.parse(text) as unknown };
  } catch {
    return { status: "unreadable" };
  }
}

/** True when the life was written. False when the browser refused (full, blocked, private mode). */
export function saveCurrent(save: unknown, storage?: Storage): boolean {
  try {
    storage ??= localStorage;
    storage.setItem(CURRENT_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearCurrent(storage?: Storage): void {
  try {
    storage ??= localStorage;
    storage.removeItem(CURRENT_KEY);
  } catch {
    // Nothing to remove if storage is not there.
  }
}

/**
 * Removes everything the game keeps in localStorage: the life in progress and the preferences. False when the
 * browser refused to remove one of the keys, so some may remain; storage that is not there has nothing to remove.
 */
export function clearLocalStorage(storage?: Storage): boolean {
  let store: Storage;
  let keys: string[];
  try {
    store = storage ?? localStorage;
    keys = Array.from({ length: store.length }, (_, i) => store.key(i)).filter(
      (key): key is string => key !== null && key.startsWith(KEY_PREFIX),
    );
  } catch {
    return true;
  }
  let cleared = true;
  for (const key of keys) {
    try {
      store.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  return cleared;
}
