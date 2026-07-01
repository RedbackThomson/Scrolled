// MemberRow wrapped with dnd-kit so the entire row is a drag handle.
// A PointerSensor distance threshold on the parent DndContext keeps plain
// clicks (navigation, note edit, qty input) working — drags only start
// once the pointer has moved past the threshold.
//
// `setActivatorNodeRef` MUST point at the same element carrying the drag
// listeners. Without it, dnd-kit's KeyboardSensor activator can't tell that a
// space keydown originated inside a child input (its guard is
// `event.target !== activator`), so typing a space in the notes field would
// start a keyboard drag, `preventDefault` the space char, and — via dnd-kit's
// post-drag focus restore — hand focus to the first focusable child (the
// "mark done" checkbox), where the next space toggles it.

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CollectionMember } from '@/db/user';
import { MemberRow } from './MemberRow';
import { memberDndId } from './dndIds';
import { cn } from '@scrolled/ui';

interface SortableMemberRowProps {
  member: CollectionMember;
  name: string | null;
  /** Skip drag listeners when a non-manual sort is active. The row
   *  still renders and remains a layout participant. */
  disabled?: boolean;
}

export function SortableMemberRow({ member, name, disabled = false }: SortableMemberRowProps) {
  const id = memberDndId(member.entityType, member.entityId);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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

  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    setActivatorNodeRef(node);
  };

  return (
    <div
      ref={setRefs}
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
