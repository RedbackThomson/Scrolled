// A collection member's identity is (collection, group, entityType, entityId):
// the same entity can sit in more than one group of a collection, so every
// single-row member operation must name the group too. The default (ungrouped)
// bucket is a NULL `group_id`, which needs `IS NULL` rather than `= ?`.

import type { CollectionEntityType } from '../types';

export interface MemberIdentity {
  where: string;
  params: (string | number)[];
}

export function memberIdentity(
  collectionId: number,
  groupId: number | null,
  entityType: CollectionEntityType | string,
  entityId: number,
): MemberIdentity {
  if (groupId == null) {
    return {
      where: 'collection_id = ? AND group_id IS NULL AND entity_type = ? AND entity_id = ?',
      params: [collectionId, entityType, entityId],
    };
  }
  return {
    where: 'collection_id = ? AND group_id = ? AND entity_type = ? AND entity_id = ?',
    params: [collectionId, groupId, entityType, entityId],
  };
}
