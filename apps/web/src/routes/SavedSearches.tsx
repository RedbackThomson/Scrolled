import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, GripVertical, Pin } from 'lucide-react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, EmptyState, IconButton, SlotTile, SwipeRow, cn } from '@scrolled/design';
import { SAVED_SEARCH_SCOPES, type PinnedSearchRecord, type SavedSearchScope } from '@/db/user';
import {
  useDeletePinnedSearch,
  usePinnedSearches,
  useReorderPinnedSearches,
  useUpdatePinnedSearch,
} from '@/hooks/usePinnedSearches';
import { usePageTitle } from '@/hooks/usePageTitle';
import { labelForScope } from '@/lib/entityRoutes';
import { ConfirmDialog } from '@/components/collections/ConfirmDialog';
import { SaveSearchDialog, savedSearchLook } from '@/components/pinned-searches';
import { isFilterParam } from '@/components/data-table/filterParams';

/** How many columns a saved search filters on; min/max/mode params belong to one column. */
function filterCount(params: Record<string, string>): number {
  return new Set(
    Object.keys(params)
      .filter(isFilterParam)
      .map((k) => k.replace(/_(min|max|mode)$/, '')),
  ).size;
}

export default function SavedSearches() {
  usePageTitle('Saved searches');
  const navigate = useNavigate();
  const allQ = usePinnedSearches();
  const deleteM = useDeletePinnedSearch();
  const [editing, setEditing] = useState<PinnedSearchRecord | null>(null);
  const [deleting, setDeleting] = useState<PinnedSearchRecord | null>(null);
  const all = allQ.data ?? [];

  return (
    <div className="max-w-2xl space-y-4">
      <header className="flex items-center gap-2">
        <span className="md:hidden">
          <IconButton
            icon={ArrowLeft}
            variant="float"
            size={44}
            label="Go back"
            onClick={() => navigate(-1)}
          />
        </span>
        <h1 className="font-display flex-1 text-[28px] font-semibold leading-none md:text-4xl">
          Saved searches
        </h1>
        <Button className="md:hidden" onClick={() => navigate(-1)}>
          Done
        </Button>
      </header>

      {allQ.isSuccess && all.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved searches yet"
          body="Filter a list, then save the search to keep it here."
        />
      ) : (
        SAVED_SEARCH_SCOPES.map((scope) => {
          const rows = all.filter((s) => s.entity === scope);
          if (rows.length === 0) return null;
          return (
            <ScopeSection
              key={scope}
              scope={scope}
              rows={rows}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          );
        })
      )}

      {all.length > 0 && (
        <p className="text-muted-foreground text-center text-[12.5px]">
          Drag to reorder · swipe left to delete · tap a row to rename
        </p>
      )}

      {editing && <SaveSearchDialog open search={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name ?? ''}”?`}
        message="The saved search leaves its list page and Home. Your library is untouched."
        confirmLabel="Delete"
        pending={deleteM.isPending}
        onConfirm={() => {
          if (deleting) void deleteM.mutateAsync(deleting.id).then(() => setDeleting(null));
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function ScopeSection({
  scope,
  rows,
  onEdit,
  onDelete,
}: {
  scope: SavedSearchScope;
  rows: PinnedSearchRecord[];
  onEdit: (s: PinnedSearchRecord) => void;
  onDelete: (s: PinnedSearchRecord) => void;
}) {
  const reorderM = useReorderPinnedSearches();
  const [order, setOrder] = useState(rows);
  // Local order so a drop renders at once instead of waiting for the refetch.
  useEffect(() => setOrder(rows), [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      order,
      order.findIndex((s) => s.id === active.id),
      order.findIndex((s) => s.id === over.id),
    );
    setOrder(next);
    reorderM.mutate(next.map((s) => s.id));
  };

  return (
    <section className="space-y-2">
      <h2 className="font-display text-muted-foreground text-sm font-semibold">
        {labelForScope(scope, true)}
      </h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="border-border bg-card shadow-rim divide-y-2 divide-[var(--surface-sunken)] overflow-hidden rounded-[18px] border-2">
            {order.map((s) => (
              <Row key={s.id} search={s} onEdit={() => onEdit(s)} onDelete={() => onDelete(s)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function Row({
  search,
  onEdit,
  onDelete,
}: {
  search: PinnedSearchRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const updateM = useUpdatePinnedSearch();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: search.id,
  });
  const look = savedSearchLook(search);
  const filters = filterCount(search.params);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 shadow-[0_12px_30px_var(--shadow-color)]')}
    >
      <SwipeRow onAction={onDelete}>
        <div className="flex min-h-[58px] items-center gap-3 pl-1.5 pr-2">
          <button
            type="button"
            aria-label={`Reorder ${search.name}`}
            className="sc-focus-ring text-muted-foreground grid h-11 w-8 cursor-grab touch-none place-items-center rounded-md"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="sc-focus-ring flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
          >
            <SlotTile icon={look.icon} hue={look.hue} size={36} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-bold">{search.name}</span>
              <span className="text-muted-foreground text-xs">
                {filters} {filters === 1 ? 'filter' : 'filters'}
              </span>
            </span>
          </button>
          <IconButton
            icon={Pin}
            size={44}
            variant="ghost"
            aria-pressed={search.pinned}
            label={search.pinned ? `Unpin ${search.name} from Home` : `Pin ${search.name} to Home`}
            onClick={() => updateM.mutate({ id: search.id, patch: { pinned: !search.pinned } })}
            className={search.pinned ? 'text-[color:var(--gold)]' : 'text-muted-foreground'}
          />
        </div>
      </SwipeRow>
    </li>
  );
}
