import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { cn } from '@scrolled/design';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SlidingNavPillProps {
  /** Positioned ancestor of the nav rows; the pill is laid out in its coordinates. */
  containerRef: RefObject<HTMLElement>;
  /** Re-measure when any of these change (route, sidebar collapse). */
  watch: readonly unknown[];
}

/**
 * One highlight that slides to the active nav row, instead of each row toggling
 * its own background. Rows mark themselves with `data-nav-active`; the last
 * match wins, so a settings group beats its parent "Settings" row.
 */
export function SlidingNavPill({ containerRef, watch }: SlidingNavPillProps) {
  const [box, setBox] = useState<Box | null>(null);
  const [visible, setVisible] = useState(false);
  // The first placement jumps into position; only later moves slide.
  const [placed, setPlaced] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const rows = container.querySelectorAll<HTMLElement>('[data-nav-active]');
      const row = rows[rows.length - 1];
      if (!row) {
        setVisible(false);
        return;
      }
      const c = container.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      setBox({ top: r.top - c.top, left: r.left - c.left, width: r.width, height: r.height });
      setVisible(true);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `watch` is the caller's dependency list
  }, [containerRef, ...watch]);

  useEffect(() => {
    if (!box || placed) return;
    const frame = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(frame);
  }, [box, placed]);

  if (!box) return null;
  return (
    <span
      aria-hidden
      className={cn(
        'bg-card shadow-float pointer-events-none absolute rounded-full',
        placed &&
          'ease-spring transition-[top,left,width,height,opacity] [transition-duration:520ms]',
        !visible && 'opacity-0',
      )}
      style={box}
    />
  );
}
