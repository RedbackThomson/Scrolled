// Edit-mode shell for the home page.
//
// Hosts the dnd-kit context, renders visible sections as sortable rows,
// and surfaces a strip of hidden sections at the bottom that the user
// can click to restore. The page's editing banner exits edit mode;
// persistence happens on every drag/move/hide/show, so there's no
// "save" step.

import { useCallback, useState, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { HOME_SECTION_LABEL, type HomeSectionId } from './layout';
import { SortableSection } from './SortableSection';
import type { UseHomeLayoutResult } from './useHomeLayout';

interface Props {
  layout: UseHomeLayoutResult;
  /** Renders the widget content for a given section id. Returns null
   *  when the widget itself decides it has nothing to show. */
  renderSection: (id: HomeSectionId) => ReactNode;
}

export function HomeEditor({ layout, renderSection }: Props) {
  const visibleEntries = layout.entries.filter((e) => e.visible);
  const hiddenEntries = layout.entries.filter((e) => !e.visible);
  const visibleIds = visibleEntries.map((e) => e.id);

  // PointerSensor + KeyboardSensor — the keyboard sensor lets users move
  // a section with Space + arrows, matching the dnd-kit a11y recipe.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveVisible = useCallback(
    (oldIndex: number, newIndex: number) => {
      const nextVisibleOrder = arrayMove(visibleIds, oldIndex, newIndex);
      // Stitch the hidden entries back in at their existing relative
      // positions so they don't get knocked around by a move.
      const nextOrder: HomeSectionId[] = [];
      let vi = 0;
      for (const e of layout.entries) {
        nextOrder.push(e.visible ? nextVisibleOrder[vi++]! : e.id);
      }
      void layout.setOrder(nextOrder);
    },
    [layout, visibleIds],
  );

  // Where the dragged section will land, drawn as a line on the edge of the
  // section it's over: below it when moving down, above it when moving up.
  const [drop, setDrop] = useState<{ id: HomeSectionId; edge: 'top' | 'bottom' } | null>(null);

  const onDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over || active.id === over.id) return setDrop(null);
      const from = visibleIds.indexOf(active.id as HomeSectionId);
      const to = visibleIds.indexOf(over.id as HomeSectionId);
      setDrop({ id: over.id as HomeSectionId, edge: from < to ? 'bottom' : 'top' });
    },
    [visibleIds],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDrop(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = visibleIds.indexOf(active.id as HomeSectionId);
      const newIndex = visibleIds.indexOf(over.id as HomeSectionId);
      if (oldIndex === -1 || newIndex === -1) return;
      moveVisible(oldIndex, newIndex);
    },
    [visibleIds, moveVisible],
  );

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrop(null)}
      >
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3">
            {visibleEntries.map((entry, i) => (
              <li key={entry.id}>
                <SortableSection
                  id={entry.id}
                  dropEdge={drop?.id === entry.id ? drop.edge : null}
                  onHide={() => void layout.setVisibility(entry.id, false)}
                  onMoveUp={i > 0 ? () => moveVisible(i, i - 1) : undefined}
                  onMoveDown={
                    i < visibleEntries.length - 1 ? () => moveVisible(i, i + 1) : undefined
                  }
                >
                  {renderSection(entry.id)}
                </SortableSection>
              </li>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {hiddenEntries.length > 0 && (
        <section>
          <h3 className="font-display text-muted-foreground mb-2 text-[15px] font-semibold">
            Hidden sections
          </h3>
          <ul className="flex flex-wrap gap-2">
            {hiddenEntries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => void layout.setVisibility(entry.id, true)}
                  className="border-border text-muted-foreground hover:border-primary hover:text-foreground inline-flex items-center gap-1.5 rounded-full border-2 border-dashed px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <Eye className="h-3 w-3" />
                  {HOME_SECTION_LABEL[entry.id]}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
