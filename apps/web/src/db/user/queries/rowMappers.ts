import type { Row } from '@scrolled/extractor/db/sqlite';
import {
  COLLECTION_GROUPINGS,
  COLLECTION_SORT_DIRS,
  COLLECTION_SORT_KEYS,
  type CollectionEntityType,
  type CollectionGroup,
  type CollectionMember,
  type CollectionRecord,
  type PinnedSearchRecord,
} from '../types';

export function rowToMember(row: Row): CollectionMember {
  return {
    collectionId: Number(row.collection_id),
    entityType: String(row.entity_type) as CollectionEntityType,
    entityId: Number(row.entity_id),
    note: row.note == null ? null : String(row.note),
    quantity: row.quantity == null ? null : Number(row.quantity),
    done: Number(row.done) === 1,
    addedAt: Number(row.added_at),
    groupId: row.group_id == null ? null : Number(row.group_id),
    position: Number(row.position ?? 0),
  };
}

export function rowToGroup(row: Row): CollectionGroup {
  return {
    id: Number(row.id),
    collectionId: Number(row.collection_id),
    name: String(row.name),
    position: Number(row.position),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function rowToPinnedSearch(row: Row): PinnedSearchRecord {
  let params: Record<string, string> = {};
  const raw = row.params_json;
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        params = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
        );
      }
    } catch {
      params = {};
    }
  }
  return {
    id: Number(row.id),
    name: String(row.name),
    entity: String(row.entity) as CollectionEntityType,
    params,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function rowToCollection(row: Row): CollectionRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    color: row.color == null ? null : String(row.color),
    icon: row.icon == null ? null : String(row.icon),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    memberCount: Number(row.member_count ?? 0),
    pinned: Number(row.pinned ?? 0) === 1,
    pinnedPosition: row.pinned_position == null ? null : Number(row.pinned_position),
    grouping: parseEnum(row.grouping, COLLECTION_GROUPINGS, 'group'),
    subgrouping: parseEnum(row.subgrouping, COLLECTION_GROUPINGS, 'type'),
    sortKey: parseEnum(row.sort_key, COLLECTION_SORT_KEYS, 'manual'),
    sortDir: parseEnum(row.sort_dir, COLLECTION_SORT_DIRS, 'asc'),
  };
}

function parseEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw == null) return fallback;
  const s = String(raw);
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}
