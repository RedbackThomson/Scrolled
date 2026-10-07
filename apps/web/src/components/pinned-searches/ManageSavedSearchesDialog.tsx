import { useEffect, useState } from 'react';
import { GripVertical, Pin, Trash2 } from 'lucide-react';
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
import { Button, cn, IconButton, SlotTile, TextField } from '@scrolled/design';
import type { PinnedSearchRecord, SavedSearchScope } from '@/db/user';
import {
  useDeletePinnedSearch,
  usePinnedSearches,
  useReorderPinnedSearches,
  useUpdatePinnedSearch,
} from '@/hooks/usePinnedSearches';
import { labelForScope } from '@/lib/entityRoutes';
import { Modal } from '@/components/collections/Modal';
import { ConfirmDialog } from '@/components/collections/ConfirmDialog';
import { SaveSearchDialog } from './SaveSearchDialog';
import { savedSearchLook } from './savedSearchLook';

interface ManageSavedSearchesDialogProps {
  open: boolean;
  onClose: () => void;
  scope: SavedSearchScope;
}

/** Reorder, rename, restyle, pin and delete one list page's saved searches. */
export function ManageSavedSearchesDialog({
  open,
  onClose,
  scope,
}: ManageSavedSearchesDialogProps) {
  const allQ = usePinnedSearches();
  const reorderM = useReorderPinnedSearches();
  const deleteM = useDeletePinnedSearch();
  const [order, setOrder] = useState<PinnedSearchRecord[]>([]);
  const [editing, setEditing] = useState<PinnedSearchRecord | null>(null);
  const [deleting, setDeleting] = useState<PinnedSearchRecord | null>(null);

  // Local order so a drop renders at once instead of waiting for the refetch.
  useEffect(() => {
    setOrder((allQ.data ?? []).filter((s) => s.entity === scope));
  }, [allQ.data, scope]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((s) => s.id === active.id);
    const to = order.findIndex((s) => s.id === over.id);
    const next = arrayMove(order, from, to);
    setOrder(next);
    reorderM.mutate(next.map((s) => s.id));
  };

  return (
    <>
      <Modal
        open={open && !editing && !deleting}
        onClose={onClose}
        title={`Saved ${labelForScope(scope, true).toLowerCase()} searches`}
        panelClassName="w-full max-w-lg"
        footer={
          <Button type="button" size="sm" onClick={onClose}>
            Done
          </Button>
        }
      >
        {order.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No saved searches on this page yet.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="border-border shadow-rim divide-y-2 divide-[var(--surface-sunken)] overflow-hidden rounded-[18px] border-2">
                {order.map((s) => (
                  <SavedSearchRow
                    key={s.id}
                    search={s}
                    onEdit={() => setEditing(s)}
                    onDelete={() => setDeleting(s)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        {order.length > 1 && (
          <p className="text-muted-foreground mt-2.5 text-center text-xs">
            Drag to reorder. Click a picture to change its icon or colour.
          </p>
        )}
      </Modal>
      {editing && <SaveSearchDialog open search={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name ?? ''}”?`}
        message="The saved search leaves this page and Home. Your library is untouched."
        confirmLabel="Delete"
        pending={deleteM.isPending}
        onConfirm={() => {
          if (deleting) void deleteM.mutateAsync(deleting.id).then(() => setDeleting(null));
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function SavedSearchRow({
  search,
  onEdit,
  onDelete,
}: {
  search: PinnedSearchRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const updateM = useUpdatePinnedSearch();
  const [name, setName] = useState(search.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: search.id,
  });
  const look = savedSearchLook(search);

  useEffect(() => setName(search.name), [search.name]);

  const rename = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === search.name) return setName(search.name);
    updateM.mutate(
      { id: search.id, patch: { name: trimmed } },
      { onError: () => setName(search.name) },
    );
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-card flex min-h-[58px] items-center gap-2.5 pl-1.5 pr-2',
        isDragging && 'relative z-10 shadow-[0_12px_30px_var(--shadow-color)]',
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${search.name}`}
        className="sc-focus-ring text-muted-foreground cursor-grab rounded-md p-1 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Change the icon and colour of ${search.name}`}
        className="sc-focus-ring rounded-[11px]"
      >
        <SlotTile icon={look.icon} hue={look.hue} size={36} />
      </button>
      <TextField
        variant="ghost"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={rename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            e.stopPropagation();
            setName(search.name);
          }
        }}
        aria-label="Name"
        className="flex-1"
        style={{ fontWeight: 700 }}
      />
      <IconButton
        icon={Pin}
        size={32}
        variant="ghost"
        aria-pressed={search.pinned}
        label={search.pinned ? `Unpin ${search.name} from Home` : `Pin ${search.name} to Home`}
        title={search.pinned ? 'Pinned to Home' : 'Pin to Home'}
        onClick={() => updateM.mutate({ id: search.id, patch: { pinned: !search.pinned } })}
        className={search.pinned ? 'text-[color:var(--gold)]' : 'text-muted-foreground'}
      />
      <IconButton
        icon={Trash2}
        size={32}
        variant="ghost"
        label={`Delete ${search.name}`}
        onClick={onDelete}
        className="text-muted-foreground"
      />
    </li>
  );
}
