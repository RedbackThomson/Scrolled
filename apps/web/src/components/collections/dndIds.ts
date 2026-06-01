// Shared encoding for the dnd-kit string ids used by the collection
// board. The DnD library expects each draggable + droppable to have a
// unique id; we encode the kind (group / member / dropzone) and the
// natural keys so `onDragEnd` can route by ID alone.

import type { CollectionEntityType } from '@/db/user';

export const DEFAULT_GROUP_DND_ID = 'group:default';
export const NEW_GROUP_DROPZONE_ID = 'dropzone:new-group';

export function groupDndId(groupId: number | null): string {
  return groupId == null ? DEFAULT_GROUP_DND_ID : `group:${groupId}`;
}

export function parseGroupDndId(id: string): number | null | undefined {
  if (id === DEFAULT_GROUP_DND_ID) return null;
  if (id.startsWith('group:')) {
    const raw = id.slice('group:'.length);
    const num = Number(raw);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

export function memberDndId(entityType: CollectionEntityType, entityId: number): string {
  return `member:${entityType}:${entityId}`;
}

export function parseMemberDndId(
  id: string,
): { entityType: CollectionEntityType; entityId: number } | null {
  if (!id.startsWith('member:')) return null;
  const rest = id.slice('member:'.length);
  const sep = rest.indexOf(':');
  if (sep < 0) return null;
  const entityType = rest.slice(0, sep) as CollectionEntityType;
  const entityId = Number(rest.slice(sep + 1));
  if (!Number.isFinite(entityId)) return null;
  return { entityType, entityId };
}
