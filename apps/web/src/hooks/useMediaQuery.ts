import { useEffect, useState } from 'react';

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/** Subscribes to a CSS media query. Prefer Tailwind variants for purely cosmetic changes. */
export function useMediaQuery(query: string): boolean {
  const [isMatch, setIsMatch] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    setIsMatch(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setIsMatch(event.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // Safari < 14 fallback — matches the precedent in the design package's theme store.
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);
  return isMatch;
}
