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

// A member id carries its group too: the same entity can appear in more than
// one group's bucket, so `(entityType, entityId)` alone is no longer unique on
// the board. `default` is the token for the ungrouped bucket.
const DEFAULT_GROUP_TOKEN = 'default';

export function memberDndId(
  entityType: CollectionEntityType,
  entityId: number,
  groupId: number | null,
): string {
  const group = groupId == null ? DEFAULT_GROUP_TOKEN : String(groupId);
  return `member:${entityType}:${entityId}:${group}`;
}

export function parseMemberDndId(
  id: string,
): { entityType: CollectionEntityType; entityId: number; groupId: number | null } | null {
  if (!id.startsWith('member:')) return null;
  const parts = id.split(':');
  if (parts.length !== 4) return null;
  const [, entityType, rawId, rawGroup] = parts;
  const entityId = Number(rawId);
  if (!Number.isFinite(entityId)) return null;
  const groupId = rawGroup === DEFAULT_GROUP_TOKEN ? null : Number(rawGroup);
  if (groupId != null && !Number.isFinite(groupId)) return null;
  return { entityType: entityType as CollectionEntityType, entityId, groupId };
}
