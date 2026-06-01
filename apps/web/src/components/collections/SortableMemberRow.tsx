// MemberRow wrapped with dnd-kit so the entire row is a drag handle.
// A PointerSensor distance threshold on the parent DndContext keeps plain
// clicks (navigation, note edit, qty input) working — drags only start
// once the pointer has moved past the threshold.

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CollectionMember } from '@/db/user';
import { MemberRow } from './MemberRow';
import { memberDndId } from './dndIds';
import { cn } from '@/lib/utils';

interface SortableMemberRowProps {
  member: CollectionMember;
  name: string | null;
  /** Skip drag listeners when a non-manual sort is active. The row
   *  still renders and remains a layout participant. */
  disabled?: boolean;
}

export function SortableMemberRow({ member, name, disabled = false }: SortableMemberRowProps) {
  const id = memberDndId(member.entityType, member.entityId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    data: {
      kind: 'member',
      entityType: member.entityType,
      entityId: member.entityId,
      groupId: member.groupId,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.7 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      className={cn(
        !disabled && 'cursor-grab active:cursor-grabbing',
        isDragging && 'cursor-grabbing',
      )}
    >
      <MemberRow member={member} name={name} />
    </div>
  );
}
