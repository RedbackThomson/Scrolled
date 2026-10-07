import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { Icon } from '../core/Icon';

const ACTION_WIDTH = 84;

export interface SwipeRowProps {
  children: ReactNode;
  /** Revealed by swiping the row left */
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction: () => void;
}

/** A list row that slides left to reveal one destructive action, as on phone lists. */
export function SwipeRow({
  children,
  actionLabel = 'Delete',
  actionIcon = Trash2,
  onAction,
}: SwipeRowProps) {
  const [x, setX] = useState(0);
  const start = useRef<{ x: number; y: number; from: number; swiping: boolean } | null>(null);

  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      start.current = { x: e.clientX, y: e.clientY, from: x, swiping: false };
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      // Vertical drags belong to the list's scroll or its reorder handle.
      if (!s.swiping && Math.abs(dx) < 8) return;
      if (!s.swiping && Math.abs(e.clientY - s.y) > Math.abs(dx)) {
        start.current = null;
        return;
      }
      s.swiping = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setX(Math.min(0, Math.max(-ACTION_WIDTH, s.from + dx)));
    },
    onPointerUp: () => {
      if (start.current?.swiping) setX((v) => (v < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0));
      start.current = null;
    },
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onAction}
        tabIndex={x === 0 ? -1 : 0}
        aria-hidden={x === 0}
        className="sc-focus-ring"
        style={{
          position: 'absolute',
          inset: '0 0 0 auto',
          width: ACTION_WIDTH,
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          background: 'linear-gradient(180deg, var(--danger-hi), var(--danger))',
          color: '#fff',
          font: '700 12.5px var(--font-body)',
          cursor: 'pointer',
        }}
      >
        <Icon icon={actionIcon} size={17} />
        {actionLabel}
      </button>
      <div
        {...handlers}
        style={{
          position: 'relative',
          background: 'var(--surface-card)',
          transform: `translateX(${x}px)`,
          transition: start.current?.swiping
            ? 'none'
            : 'transform var(--dur-base) var(--ease-spring)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
