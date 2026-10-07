// Mirrors a listing page's URL search params into localStorage so the
// user keeps their filters, sort, and visible-columns set when they
// leave the table — whether to a detail page (browser back works on its
// own), via the sidebar (which navigates to the bare listing URL), or
// across a tab close/reopen.
//
// Restore runs once on mount, only when the URL has no search params of
// its own; the URL always wins when it brings state. The restore goes
// through React Router's navigate() so nuqs (configured with the
// react-router-v6 adapter) sees the location change and re-parses.
//
// Mirroring runs on every render because nuqs uses `history.replaceState`
// that bypasses React Router's location subscription — `useLocation`
// won't notice nuqs-driven URL changes. The effect compares against the
// previous saved string and only writes when something actually changed.

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FacetSource } from '@/db';

const KEY_PREFIX = 'scrolled.tableState.';

function storageKey(entity: FacetSource) {
  return `${KEY_PREFIX}${entity}`;
}

export function useTableStatePersistence(entity: FacetSource | undefined) {
  const navigate = useNavigate();
  const restored = useRef(false);

  // Restore on first mount when the URL has no params of its own.
  useEffect(() => {
    if (!entity) return;
    if (restored.current) return;
    restored.current = true;
    if (window.location.search) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey(entity));
    } catch {
      // Private-mode browsers can throw on localStorage access — silently
      // skip persistence rather than crash the table.
      return;
    }
    if (!saved) return;
    navigate({ search: saved }, { replace: true });
  }, [entity, navigate]);

  // Mirror current URL to localStorage on every render. The check
  // against the previously-stored string is what keeps this cheap:
  // a render that didn't change the URL is a no-op.
  useEffect(() => {
    if (!entity) return;
    const params = window.location.search.slice(1);
    const key = storageKey(entity);
    try {
      const prev = localStorage.getItem(key);
      if (params === prev) return;
      if (params) {
        localStorage.setItem(key, params);
      } else if (prev !== null) {
        localStorage.removeItem(key);
      }
    } catch {
      // Same private-mode tolerance as above.
    }
  });
}
