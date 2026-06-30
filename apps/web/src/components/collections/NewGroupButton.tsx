// Persistent "+ New group" affordance below the group list. Doubles as
// a click button (prompts for a name, then creates an empty group) and
// a drop target during a drag (auto-names and moves the dropped member
// into the new group). Always rendered when groups are part of the
// current layout so the action is discoverable without first starting
// a drag.

import { useDroppable } from '@dnd-kit/core';
import { FolderPlus } from 'lucide-react';
import { NEW_GROUP_DROPZONE_ID } from './dndIds';
import { cn } from '@scrolled/ui';

interface NewGroupButtonProps {
  /** Whether a drag is currently in progress — controls highlight + the
   *  "drop here" copy. */
  isDragging: boolean;
  /** Allow drops here. Disabled when sort isn't manual (drag-to-reorder
   *  is off in that case). The click action stays enabled either way. */
  acceptDrops: boolean;
  onClick: () => void;
}

export function NewGroupButton({ isDragging, acceptDrops, onClick }: NewGroupButtonProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: NEW_GROUP_DROPZONE_ID,
    data: { kind: 'new-group' },
    disabled: !acceptDrops,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm transition-colors',
        isOver
          ? 'border-primary bg-primary/10 text-primary'
          : isDragging && acceptDrops
            ? 'border-primary/60 text-primary/80 bg-primary/5'
            : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-accent/40',
      )}
      title={
        acceptDrops
          ? 'Click to create a new group, or drop an item here to create one and move it in'
          : 'Click to create a new group'
      }
    >
      <FolderPlus className="h-4 w-4" />
      {isDragging && acceptDrops
        ? isOver
          ? 'Drop here to create a new group'
          : 'Drop here to create a new group'
        : 'New group'}
    </button>
  );
}
