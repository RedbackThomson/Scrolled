import { useEffect, useState } from 'react';
import { getDbClient } from '@/db';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('icons-client');

/**
 * Identifier for an icon stored in the local database.
 *
 * Icon bytes are persisted as a BLOB on the `items` / `equips` row at
 * extraction time, so once a dataset is extracted the user no longer needs
 * the original WZ files loaded to browse with icons. The parser worker's
 * `getIconPng` is still used during extraction itself; everything else reads
 * from SQLite.
 */
export interface IconRef {
  entity: 'item' | 'equip';
  id: number;
}

/**
 * Per-entity cache of decoded icon object URLs. Grows for the lifetime of
 * the page (no eviction); a few thousand small PNG icons total ~10–25 MB,
 * which is fine for a tab lifetime. The browser reclaims the blobs on
 * page unload.
 */
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

function keyOf(ref: IconRef): string {
  return `${ref.entity}:${ref.id}`;
}

async function fetchIcon(ref: IconRef): Promise<string | null> {
  const key = keyOf(ref);
  let p = pending.get(key);
  if (!p) {
    p = (async () => {
      try {
        const cached = cache.get(key);
        if (cached) return cached;
        const db = getDbClient();
        const bytes =
          ref.entity === 'item' ? await db.getItemIcon(ref.id) : await db.getEquipIcon(ref.id);
        if (!bytes || bytes.byteLength === 0) {
          log.info('no icon bytes in db', { ...ref });
          return null;
        }
        // Copy into a fresh ArrayBuffer so the Blob type matches BlobPart
        // regardless of the underlying buffer kind.
        const buf = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(buf).set(bytes);
        const url = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
        cache.set(key, url);
        return url;
      } catch (e) {
        log.error('fetchIcon threw', { ...ref, ...describeError(e) });
        return null;
      }
    })().finally(() => {
      pending.delete(key);
    });
    pending.set(key, p);
  }
  return p;
}

/**
 * Look up the persisted icon for an entity and return an object-URL suitable
 * for use in `<img src>`. Returns `null` while loading or when no icon is
 * stored.
 */
export function useIcon(ref: IconRef | null | undefined): string | null {
  // Splat into primitives so the effect deps array is stable across renders
  // where the parent passes a fresh `{ entity, id }` object each time.
  const entity = ref?.entity ?? null;
  const id = ref?.id ?? null;
  const key = entity && id !== null ? `${entity}:${id}` : null;
  const [url, setUrl] = useState<string | null>(() => (key ? (cache.get(key) ?? null) : null));

  useEffect(() => {
    let cancelled = false;
    if (!entity || id === null) {
      setUrl(null);
      return;
    }
    const cached = cache.get(`${entity}:${id}`);
    if (cached) {
      setUrl(cached);
      return;
    }
    setUrl(null);
    fetchIcon({ entity, id }).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [entity, id]);

  return url;
}
