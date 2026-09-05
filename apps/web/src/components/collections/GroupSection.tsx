// A user-defined group rendered as a sortable section. The header is the drag
// handle for the group itself; the title opens an edit dialog (name +
// description). The body renders whatever member list the parent puts inside,
// and the group's description shows beneath the header.
//
// A null `group` means the default (implicit) group; edit and delete are hidden
// there since it has no row to operate on.

import { useState, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Pencil } from 'lucide-react';
import { useDeleteGroup } from '@/hooks/useCollections';
import type { CollectionGroup } from '@/db/user';
import { groupDndId } from './dndIds';
import { GroupFormDialog } from './GroupFormDialog';
import { cn } from '@scrolled/ui';

interface GroupSectionProps {
  /** The group record, or null for the default (implicit) group. */
  group: CollectionGroup | null;
  /** Display label — 'Ungrouped' for the default group. */
  name: string;
  count: number;
  /** When false the header is hidden (only-the-default-group case). */
  showHeader: boolean;
  /** Allow the group itself to be dragged. False in axis = 'type'. */
  draggable: boolean;
  children: ReactNode;
}

export function GroupSection({ group, name, count, showHeader, draggable, children }: GroupSectionProps) {
  const groupId = group?.id ?? null;
  const id = groupDndId(groupId);

  // Default groups (and groups in axis = 'type') aren't draggable but
  // still need to accept drops on their header — use dnd-kit's granular
  // `disabled` form so droppable stays enabled.
  const dragDisabled = !draggable || groupId == null;
  const sortable = useSortable({
    id,
    disabled: { draggable: dragDisabled, droppable: false },
    data: { kind: 'group', groupId },
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  const deleteM = useDeleteGroup();
  const [editOpen, setEditOpen] = useState(false);

  const isDefault = group == null;

  const onDelete = async () => {
    if (isDefault) return;
    if (!confirm(`Delete group "${name}"? Its ${count} member(s) will move to the default group.`)) {
      return;
    }
    await deleteM.mutateAsync(group.id);
  };

  return (
    <section ref={setNodeRef} style={style} className="space-y-2">
      {showHeader && (
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            {draggable && !isDefault ? (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="text-muted-foreground hover:text-foreground -ml-1 flex h-6 w-6 cursor-grab items-center justify-center rounded-md transition-colors active:cursor-grabbing"
                aria-label={`Drag to reorder group ${name}`}
                title="Drag to reorder"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="w-5" />
            )}

            <button
              type="button"
              onClick={() => {
                if (isDefault) return;
                setEditOpen(true);
              }}
              className={cn(
                'group inline-flex items-center gap-1.5 text-left text-sm font-semibold tracking-tight',
                isDefault ? 'text-muted-foreground cursor-default' : 'hover:text-foreground',
              )}
            >
              <span className="truncate">{name}</span>
              <span className="text-muted-foreground text-xs font-normal">({count})</span>
              {!isDefault && (
                <Pencil className="text-muted-foreground/70 group-hover:text-muted-foreground h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </button>

            {!isDefault && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleteM.isPending}
                className="text-muted-foreground hover:text-destructive ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md"
                aria-label={`Delete group ${name}`}
                title="Delete group"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {group?.description && (
            <p className="text-muted-foreground whitespace-pre-line pl-7 text-xs leading-relaxed">
              {group.description}
            </p>
          )}
        </header>
      )}

      {children}

      {group && (
        <GroupFormDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          collectionId={group.collectionId}
          group={group}
        />
      )}
    </section>
  );
}
