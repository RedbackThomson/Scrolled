// One sortable item in edit mode. Wraps a widget with a drag handle on
// the left edge and a Hide button on the right, and applies the dnd-kit
// transform so the row moves with the drag.

import type { ReactNode } from 'react';
import { GripVertical, EyeOff } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HOME_SECTION_LABEL, type HomeSectionId } from './layout';

export function SortableSection({
  id,
  onHide,
  children,
}: {
  id: HomeSectionId;
  onHide: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  // dnd-kit returns a transform value the consumer applies via inline
  // style; using `CSS.Transform.toString` keeps the helper in lockstep
  // with the library's internal coordinate math.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the dragged item above its neighbors so the drop shadow reads
    // as elevated; the dnd-kit default leaves z-index unset.
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-border bg-card shadow-rim relative rounded-lg border-2 border-dashed p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="bg-muted text-muted-foreground hover:text-foreground flex h-7 w-7 cursor-grab items-center justify-center rounded-[9px] transition-colors active:cursor-grabbing"
          aria-label={`Drag to reorder ${HOME_SECTION_LABEL[id]}`}
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="font-display text-foreground flex-1 text-[15px] font-semibold">
          {HOME_SECTION_LABEL[id]}
        </span>
        <button
          type="button"
          onClick={onHide}
          className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
          title="Hide this section"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Hide
        </button>
      </div>
      <div className="pointer-events-none opacity-90">{children}</div>
    </div>
  );
}
