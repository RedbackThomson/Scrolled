import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface PopoverCoords {
  top: number;
  left: number;
}

/**
 * Trigger-anchored popover plumbing shared by the inline filter/menu popovers:
 * open state, trigger/popover refs, fixed-position coords recomputed under the
 * trigger on open/resize/scroll, and outside-click + Escape dismissal. The
 * popover body is expected to be portaled and positioned with `coords`.
 */
export function usePopover<
  T extends HTMLElement = HTMLButtonElement,
  P extends HTMLElement = HTMLDivElement,
>() {
  const triggerRef = useRef<T>(null);
  const popoverRef = useRef<P>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  // Position the popover under the trigger. useLayoutEffect avoids a flash
  // at (0, 0) on open. Recompute on resize/scroll so it follows the trigger.
  // After the popover mounts we re-place using its measured width so a
  // popover anchored at a right-aligned trigger doesn't fall off the page.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const popoverWidth = popoverRef.current?.offsetWidth ?? 0;
      // First-pass (popover not yet mounted) anchors to the trigger's left
      // edge; once the popover is in the DOM and we know its width, clamp the
      // left coordinate so the right edge sits inside the viewport.
      const MARGIN = 8;
      const maxLeft =
        popoverWidth > 0 ? window.innerWidth - popoverWidth - MARGIN : Infinity;
      const left = Math.max(MARGIN, Math.min(r.left, maxLeft));
      setCoords({ top: r.bottom + 4, left });
    };
    place();
    // Re-place after the popover mounts so the clamp can use its real width.
    const rafId = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Outside click + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return { open, setOpen, close, coords, triggerRef, popoverRef };
}
