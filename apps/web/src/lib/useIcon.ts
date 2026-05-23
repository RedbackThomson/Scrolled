import { useEffect, useState } from 'react';
import { getParserClient } from '@/parser';

/**
 * Per-path cache of decoded icon object URLs.
 *
 * The cache grows for the lifetime of the page and is never evicted. Earlier
 * versions ran a 256-entry LRU and called `URL.revokeObjectURL` on evictions,
 * but the typical extracted dataset has thousands of items, so eviction
 * revoked URLs that were still in use by `<img>` tags elsewhere on the page
 * — silently breaking icons everywhere except the most recently decoded
 * handful.
 *
 * A few thousand 32×32 PNG icons total ~10–25 MB, which is fine for a tab
 * lifetime. The browser reclaims the blobs when the page unloads.
 */
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

async function fetchIcon(path: string): Promise<string | null> {
  let p = pending.get(path);
  if (!p) {
    p = (async () => {
      const cached = cache.get(path);
      if (cached) return cached;
      const bytes = await getParserClient().getIconPng(path);
      if (!bytes) return null;
      // Copy into a fresh ArrayBuffer so the Blob type matches BlobPart even
      // when the source is a Uint8Array<SharedArrayBuffer>.
      const buf = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buf).set(bytes);
      const url = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
      cache.set(path, url);
      return url;
    })().finally(() => {
      pending.delete(path);
    });
    pending.set(path, p);
  }
  return p;
}

/**
 * Look up a WZ icon and return an object-URL suitable for use in `<img src>`.
 * Returns `null` while loading or if the icon couldn't be decoded.
 *
 * The cache survives across components, so revisiting an item page doesn't
 * re-decode.
 */
export function useIcon(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? (cache.get(path) ?? null) : null));

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = cache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    setUrl(null);
    fetchIcon(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}
