/**
 * In-memory cache for admin page data, keyed by the `useLoad` key.
 *
 * Revisiting a page (or going back to a previous filter/page) renders the last answer instantly while a fresh
 * copy loads in the background. It lives only in this tab's memory and is cleared on logout / session expiry,
 * so one account never sees another account's data.
 */

const MAX_ENTRIES = 60;
const store = new Map<string, unknown>();

export const loadCache = {
  get<T>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  },
  set(key: string, value: unknown) {
    // Re-insert so the Map order doubles as "least recently used first".
    store.delete(key);
    store.set(key, value);
    if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
  },
  clear() {
    store.clear();
  },
};
