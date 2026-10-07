import { useSyncExternalStore } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';

/** `data-motion` on <html> wins; without it the device's reduced-motion preference decides. */
export function resolveMotion(attr: string | undefined, reducedMotion: boolean): boolean {
  if (attr === 'on') return true;
  if (attr === 'off') return false;
  return !reducedMotion;
}

function read(): boolean {
  if (typeof document === 'undefined') return false;
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia(REDUCED).matches;
  return resolveMotion(document.documentElement.dataset.motion, reduced);
}

function subscribe(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  const mql = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED) : null;
  mql?.addEventListener?.('change', onChange);
  return () => {
    observer.disconnect();
    mql?.removeEventListener?.('change', onChange);
  };
}

/**
 * Whether JS-driven motion may run. CSS animations are already silenced by the
 * kill switch in base.css; this is for effects that bypass it (spawned nodes,
 * Web Animations, counters).
 */
export function usePrefersMotion(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
