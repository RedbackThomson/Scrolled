import { useEffect, useState } from 'react';

// Mirrors the inverse of Tailwind's default `md` breakpoint (768px). Sub-pixel
// safe so browsers that report fractional viewport widths still resolve here.
const MOBILE_QUERY = '(max-width: 767.98px)';

function getInitial(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * Subscribes to viewport-width changes around the `md` breakpoint. Use this
 * when behaviour needs to branch in JS (rendering a sheet instead of a sidebar,
 * swapping cards for a table). Prefer Tailwind responsive utilities when the
 * change is purely cosmetic.
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
    // Safari < 14 fallback — matches the precedent in stores/theme.ts.
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return isMobile;
}
