import type { Row } from '../../sqlite';
import type {
  CollectionEntityType,
  CollectionMember,
  CollectionRecord,
  PinnedSearchRecord,
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
  };
}
