// Per-browser display-options override for a collection's detail page.
//
// Mirrors Linear's display-settings model: tweaks the user makes via the
// `CollectionDisplayOptionsMenu` apply *in this browser only* (persisted
// to localStorage) until they explicitly "Set as default", at which
// point the values flush to the `collections` row in the DB and the
// local override clears. "Reset" clears the override without writing.
//
// Effective display = local override if present, else the DB default.
// The DB columns (`grouping`, `subgrouping`, `sort_key`, `sort_dir`)
// stay the source of truth for the saved default across browsers.

import { useSyncExternalStore } from 'react';
import type {
  CollectionGrouping,
  CollectionRecord,
  CollectionSortDir,
  CollectionSortKey,
} from '@/db/user';

export interface CollectionDisplay {
  grouping: CollectionGrouping;
  subgrouping: CollectionGrouping;
  sortKey: CollectionSortKey;
  sortDir: CollectionSortDir;
}

const STORAGE_KEY = 'scrolled:collection-display-overrides:v1';

type OverrideMap = Record<string, CollectionDisplay>;

let cache: OverrideMap | null = null;
const listeners = new Set<() => void>();

function load(): OverrideMap {
  if (cache) return cache;
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === 'object' ? (parsed as OverrideMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function save(next: OverrideMap) {
  cache = next;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Quota / private-mode failures are non-fatal — the override just
    // won't survive a reload. Listeners still see the update.
  }
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // Cross-tab sync: another tab editing the same collection should
  // propagate here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null; // force reload from disk on next read
      fn();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(fn);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function getOverride(collectionId: number): CollectionDisplay | undefined {
  return load()[String(collectionId)];
}

function setOverride(collectionId: number, display: CollectionDisplay) {
  save({ ...load(), [String(collectionId)]: display });
}

function clearOverride(collectionId: number) {
  const next = { ...load() };
  delete next[String(collectionId)];
  save(next);
}

/**
 * Subscribe to the override entry for a single collection. Returns
 * `undefined` when no override is set — callers should fall back to the
 * DB default in that case.
 */
function useCollectionDisplayOverride(collectionId: number): CollectionDisplay | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getOverride(collectionId),
    () => undefined,
  );
}

function defaultsFromCollection(c: CollectionRecord): CollectionDisplay {
  return {
    grouping: c.grouping,
    subgrouping: c.subgrouping,
    sortKey: c.sortKey,
    sortDir: c.sortDir,
  };
}

function sameDisplay(a: CollectionDisplay, b: CollectionDisplay): boolean {
  return (
    a.grouping === b.grouping &&
    a.subgrouping === b.subgrouping &&
    a.sortKey === b.sortKey &&
    a.sortDir === b.sortDir
  );
}

export interface CollectionDisplayState {
  /** Effective display (override if any, otherwise the DB default). */
  display: CollectionDisplay;
  /** The DB-persisted default — what "Reset" falls back to. */
  defaults: CollectionDisplay;
  /** True iff the local override differs from the DB default. */
  hasOverride: boolean;
  /** Update one or more fields in the local override. */
  setLocal: (patch: Partial<CollectionDisplay>) => void;
  /**
   * Drop the local override; the DB default takes over. Also called by
   * the menu after "Set as default" persists the override to the DB.
   */
  reset: () => void;
}

/**
 * React hook composing the DB default with the localStorage override.
 * Components that render display state (the board) and components that
 * mutate it (the menu) both call this — they stay in sync via the
 * external store.
 */
export function useCollectionDisplay(collection: CollectionRecord): CollectionDisplayState {
  const override = useCollectionDisplayOverride(collection.id);
  const defaults = defaultsFromCollection(collection);
  const display = override ?? defaults;
  const hasOverride = override != null && !sameDisplay(override, defaults);

  const setLocal = (patch: Partial<CollectionDisplay>) => {
    setOverride(collection.id, { ...display, ...patch });
  };
  const reset = () => clearOverride(collection.id);

  return { display, defaults, hasOverride, setLocal, reset };
}
