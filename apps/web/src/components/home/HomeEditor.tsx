// Edit-mode shell for the home page.
//
// Hosts the dnd-kit context, renders visible sections as sortable rows,
// and surfaces a strip of hidden sections at the bottom that the user
// can click to restore. The "Done" button at the top right exits edit
// mode; persistence happens on every drag/hide/show, so there's no
// "save" step.

import { useCallback, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = visibleIds.indexOf(active.id as HomeSectionId);
      const newIndex = visibleIds.indexOf(over.id as HomeSectionId);
      if (oldIndex === -1 || newIndex === -1) return;
      const nextVisibleOrder = arrayMove(visibleIds, oldIndex, newIndex);
      // Stitch the hidden entries back in at their existing relative
      // positions so they don't get knocked around by a drag.
      const nextOrder: HomeSectionId[] = [];
      let vi = 0;
      for (const e of layout.entries) {
        nextOrder.push(e.visible ? nextVisibleOrder[vi++]! : e.id);
      }
      void layout.setOrder(nextOrder);
    },
    [layout, visibleIds],
  );

  return (
    <div className="space-y-6">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3">
            {visibleEntries.map((entry) => (
              <li key={entry.id}>
                <SortableSection
                  id={entry.id}
                  onHide={() => void layout.setVisibility(entry.id, false)}
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
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            Hidden sections
          </h3>
          <ul className="flex flex-wrap gap-2">
            {hiddenEntries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => void layout.setVisibility(entry.id, true)}
                  className="border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs transition-colors"
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
