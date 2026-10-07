// One sortable item in edit mode. Wraps a widget with a drag handle and
// hide / move controls, and applies the dnd-kit transform so the row moves
// with the drag.

import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, EyeOff, GripVertical, type LucideIcon } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@scrolled/design';
import { HOME_SECTION_LABEL, type HomeSectionId } from './layout';

export function SortableSection({
  id,
  dropEdge,
  onHide,
  onMoveUp,
  onMoveDown,
  children,
}: {
  id: HomeSectionId;
  /** Draws the landing line on this edge while another section is dragged over it. */
  dropEdge: 'top' | 'bottom' | null;
  onHide: () => void;
  /** Omitted at the top / bottom, which disables the button. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const label = HOME_SECTION_LABEL[id];

  // dnd-kit returns a transform value the consumer applies via inline
  // style; using `CSS.Transform.toString` keeps the helper in lockstep
  // with the library's internal coordinate math.
  const style: React.CSSProperties = {
    transform: [CSS.Transform.toString(transform), isDragging && 'rotate(-0.6deg)']
      .filter(Boolean)
      .join(' '),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative rounded-[18px] px-3 pb-3 pt-2.5',
        isDragging
          ? 'bg-card shadow-[0_18px_40px_var(--shadow-color),0_0_0_2px_var(--accent)]'
          : 'border-border border-2 border-dashed [background:color-mix(in_oklab,var(--surface-card)_55%,transparent)]',
      )}
    >
      {dropEdge && (
        <span
          aria-hidden
          className={cn(
            'bg-primary pointer-events-none absolute inset-x-5 h-1.5 rounded-full shadow-[0_0_0_4px_var(--accent-glow)]',
            dropEdge === 'top' ? '-top-[9px]' : '-bottom-[9px]',
          )}
        />
      )}
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground grid h-7 w-6 cursor-grab place-items-center rounded-[9px] transition-colors active:cursor-grabbing"
          aria-label={`Drag to reorder ${label}`}
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="font-display text-foreground flex-1 text-base font-semibold">{label}</span>
        <SectionControl icon={EyeOff} label={`Hide ${label}`} onClick={onHide} />
        <SectionControl icon={ChevronUp} label={`Move ${label} up`} onClick={onMoveUp} />
        <SectionControl icon={ChevronDown} label={`Move ${label} down`} onClick={onMoveDown} />
      </div>
      <div className="pointer-events-none opacity-90">{children}</div>
    </div>
  );
}

function SectionControl({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      title={label}
      className="bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-primary/30 grid h-7 w-7 place-items-center rounded-[9px] transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
