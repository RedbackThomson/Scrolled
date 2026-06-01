// A user-defined group rendered as a sortable section. The header is the
// drag handle for the group itself; clicking the title turns it into an
// inline rename input. The body renders whatever member list the parent
// chooses to put inside.
//
// `groupId === null` means the default (implicit) group; the rename and
// delete affordances are hidden in that case since the default group
// has no row to operate on.

import { useState, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Pencil } from 'lucide-react';
import { useDeleteGroup, useRenameGroup } from '@/hooks/useCollections';
import { groupDndId } from './dndIds';
import { cn } from '@/lib/utils';

interface GroupSectionProps {
  /** Null for the default group. */
  groupId: number | null;
  name: string;
  count: number;
  /** When false the header is hidden (only-the-default-group case). */
  showHeader: boolean;
  /** Allow the group itself to be dragged. False in axis = 'type'. */
  draggable: boolean;
  children: ReactNode;
}

export function GroupSection({
  groupId,
  name,
  count,
  showHeader,
  draggable,
  children,
}: GroupSectionProps) {
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

  const renameM = useRenameGroup();
  const deleteM = useDeleteGroup();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const isDefault = groupId == null;

  const commitRename = async () => {
    const next = draft.trim();
    if (!next || next === name || isDefault) {
      setEditing(false);
      setDraft(name);
      return;
    }
    await renameM.mutateAsync({ groupId: groupId!, name: next });
    setEditing(false);
  };

  const onDelete = async () => {
    if (isDefault) return;
    if (!confirm(`Delete group "${name}"? Its ${count} member(s) will move to the default group.`)) {
      return;
    }
    await deleteM.mutateAsync(groupId!);
  };

  return (
    <section ref={setNodeRef} style={style} className="space-y-2">
      {showHeader && (
        <header className="flex items-center gap-2">
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

          {editing && !isDefault ? (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === 'Escape') {
                  setDraft(name);
                  setEditing(false);
                }
              }}
              autoFocus
              className="border-input bg-background focus-visible:ring-ring h-7 min-w-0 flex-1 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isDefault) return;
                setDraft(name);
                setEditing(true);
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
          )}

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
        </header>
      )}

      {children}
    </section>
  );
}
