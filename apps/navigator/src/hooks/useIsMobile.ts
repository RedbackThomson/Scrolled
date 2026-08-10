import { useEffect, useState } from 'react';

// Mirrors apps/web's copy of this hook — a future dedupe into a shared hooks
// package can fold both. Inverse of Tailwind's default `md` breakpoint (768px),
// sub-pixel safe so fractional viewport widths still resolve here.
const MOBILE_QUERY = '(max-width: 767.98px)';

function getInitial(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * Subscribes to viewport-width changes around the `md` breakpoint. Use this
 * when behaviour needs to branch in JS (rendering a sheet instead of a sidebar,
 * hiding the minimap). Prefer Tailwind responsive utilities for purely cosmetic
 * changes.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(getInitial);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return isMobile;
}
