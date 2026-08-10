import { useCallback, useRef, useState } from 'react';

export interface ResizableHeight {
  /** Explicit pixel height once the user has dragged; null means "use CSS default". */
  height: number | null;
  /** Attach to the element being resized — its parent bounds the drag range. */
  ref: React.RefObject<HTMLElement>;
  /** Attach to the drag handle. */
  onHandlePointerDown: (event: React.PointerEvent) => void;
}

/**
 * Pointer-drag vertical resize for a bottom panel. Dragging the handle up grows
 * the element (and shrinks whatever sibling it shares the flex column with);
 * dragging down shrinks it, down to `min`. The range is clamped to the parent's
 * height so the panel can grow to fill the column but never overflow it.
 */
export function useResizableHeight(min: number): ResizableHeight {
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      event.preventDefault();
      const max = el.parentElement?.clientHeight ?? window.innerHeight;
      const startY = event.clientY;
      const startHeight = el.offsetHeight;
      const handle = event.currentTarget as HTMLElement;
      handle.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const next = startHeight - (moveEvent.clientY - startY);
        setHeight(Math.min(Math.max(next, min), max));
      };
      const onUp = () => {
        handle.releasePointerCapture?.(event.pointerId);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    },
    [min],
  );

  return { height, ref, onHandlePointerDown };
}
