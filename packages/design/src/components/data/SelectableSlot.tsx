import type { MouseEvent, ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import { Icon } from '../core/Icon';
import { SlotTile, type SlotTileProps } from '../entity/SlotTile';

export interface SelectableSlotProps extends SlotTileProps {
  selected: boolean;
  /** Fires for clicks and Space; read `event.shiftKey` for range selection */
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Entity name, for the accessible label */
  label: string;
  /** Selection mode on touch: show the dashed outline without hover */
  selecting?: boolean;
  /** A ready-made tile (e.g. an app's entity avatar) in place of the SlotTile; match `size` */
  tile?: ReactNode;
}

/** A sprite slot that doubles as the row's checkbox. Clicking it never reaches the row. */
export function SelectableSlot({
  selected,
  onToggle,
  label,
  selecting,
  tile,
  size = 36,
  ...tileProps
}: SelectableSlotProps) {
  const radius = Math.round(size * 0.28);
  const overlay = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    placeItems: 'center',
  } as const;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={label}
      onMouseDown={(e) => {
        // Shift-click would otherwise extend the page's text selection.
        if (e.shiftKey) e.preventDefault();
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle(e);
      }}
      className="group/slot sc-focus-ring"
      style={{
        position: 'relative',
        flex: 'none',
        width: size,
        height: size,
        padding: 0,
        border: 'none',
        borderRadius: radius,
        background: 'none',
        cursor: 'pointer',
      }}
    >
      {tile ?? <SlotTile size={size} {...tileProps} />}
      {selected ? (
        <span
          aria-hidden
          className="animate-pop"
          style={{
            ...overlay,
            display: 'grid',
            background: 'color-mix(in oklab, var(--accent) 85%, transparent)',
            color: 'var(--accent-fg)',
            boxShadow: '0 0 0 2px var(--accent)',
          }}
        >
          <Icon icon={Check} size={Math.round(size * 0.5)} />
        </span>
      ) : (
        <span
          aria-hidden
          className={
            selecting ? 'grid' : 'hidden group-hover/slot:grid group-focus-visible/slot:grid'
          }
          style={{
            ...overlay,
            border: '2px dashed var(--accent)',
            background: selecting
              ? 'transparent'
              : 'color-mix(in oklab, var(--surface-card) 70%, transparent)',
            color: 'var(--accent-text)',
          }}
        >
          {!selecting && <Icon icon={Plus} size={16} />}
        </span>
      )}
    </button>
  );
}
