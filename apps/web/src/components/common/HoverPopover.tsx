// Reusable hover-card primitive.
//
// Wraps a single child element with mouseenter/leave handlers, shows a
// portaled card after a delay, keeps the card open while the user moves
// their mouse onto it, and closes on mouseleave / Escape / blur. The card
// is rendered via `createPortal` to <body> so any clipping ancestor
// (e.g. `overflow-x: auto` containers like the table wrapper) can't cut
// it off, and it flips above the trigger when there isn't room below.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface HoverPopoverProps {
  /** The trigger — typically a Link or anchor. Wrapped in an inline span. */
  children: ReactNode;
  /** Card content. Only mounted while the card is open so consumers can
   *  fire data fetches inside without paying for unopened triggers. */
  content: ReactNode;
  /** Hover delay before showing, in ms. Default 250. */
  delay?: number;
  /** Grace period after mouseleave before hiding, in ms. Default 120. */
  hideDelay?: number;
  /** Additional className for the popover panel. */
  className?: string;
  /** Classes applied to the trigger span itself (positioning, styling). */
  triggerClassName?: string;
  /** Inline style for the trigger span (e.g. absolute positioning). */
  triggerStyle?: CSSProperties;
  /** Extra attributes for the trigger span — typically `data-*` or `aria-*`. */
  triggerProps?: Record<string, string | undefined>;
  /**
   * Horizontal alignment of the popover relative to the trigger. `start`
   * (default) anchors the popover's left edge to the trigger's left; `end`
   * anchors the popover's right edge to the trigger's right, so the card
   * extends leftward — useful for triggers that sit near the right edge of
   * the viewport (e.g. infobox values in a right-side aside).
   */
  align?: 'start' | 'end';
}

const POPOVER_HEIGHT_GUESS = 240;

export function HoverPopover({
  children,
  content,
  delay = 250,
  hideDelay = 120,
  className,
  triggerClassName,
  triggerStyle,
  triggerProps,
  align = 'start',
}: HoverPopoverProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: 'top' | 'bottom';
    align: 'start' | 'end';
  } | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  const cancelTimers = useCallback(() => {
    if (showTimer.current !== null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const startShow = useCallback(() => {
    cancelTimers();
    showTimer.current = window.setTimeout(() => setOpen(true), delay);
  }, [cancelTimers, delay]);

  const startHide = useCallback(() => {
    cancelTimers();
    hideTimer.current = window.setTimeout(() => setOpen(false), hideDelay);
  }, [cancelTimers, hideDelay]);

  useEffect(() => cancelTimers, [cancelTimers]);

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    // Flip above if there's no room below but there is above.
    const fitsBelow = r.bottom + 4 + POPOVER_HEIGHT_GUESS <= window.innerHeight;
    const placement: 'top' | 'bottom' =
      fitsBelow || r.top < POPOVER_HEIGHT_GUESS ? 'bottom' : 'top';
    setCoords({
      top: placement === 'bottom' ? r.bottom + 4 : r.top - 4,
      // `align="end"` switches to right-edge anchoring — the popover is
      // then translated by -100% on X so it extends leftward from the
      // trigger's right edge. Stored separately so the translate logic can
      // combine with the existing `top`/`bottom` flip on Y.
      left: align === 'end' ? r.right : r.left,
      placement,
      align,
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  // Escape closes the popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        className={triggerClassName}
        style={triggerStyle}
        onMouseEnter={startShow}
        onMouseLeave={startHide}
        onFocus={startShow}
        onBlur={startHide}
        {...triggerProps}
      >
        {children}
      </span>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform: [
                coords.align === 'end' ? 'translateX(-100%)' : null,
                coords.placement === 'top' ? 'translateY(-100%)' : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined,
            }}
            className={cn(
              'border-border bg-card text-card-foreground z-50 rounded-md border p-3 shadow-md',
              className,
            )}
            onMouseEnter={cancelTimers}
            onMouseLeave={startHide}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
