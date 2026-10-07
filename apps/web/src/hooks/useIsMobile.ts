import { useMediaQuery } from './useMediaQuery';

// Mirrors the inverse of Tailwind's default `md` breakpoint (768px). Sub-pixel
// safe so browsers that report fractional viewport widths still resolve here.
const MOBILE_QUERY = '(max-width: 767.98px)';

/**
 * Subscribes to viewport-width changes around the `md` breakpoint. Use this
 * when behaviour needs to branch in JS (rendering a sheet instead of a sidebar,
 * swapping cards for a table). Prefer Tailwind responsive utilities when the
 * change is purely cosmetic.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
