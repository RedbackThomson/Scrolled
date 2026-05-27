import type { Sqlite } from '../sqlite';
import type { EntityKind, EntitySummary, SearchEntry } from '../types';
import { ENTITY_TABLES } from './shared/tables';

export function listSearchEntries(sql: Sqlite): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const r of sql.selectObjects<{
    id: number;
    name: string;
    category: string | null;
  }>(`SELECT id, name, category FROM items`)) {
    out.push({ id: r.id, name: r.name, entity: 'item', category: r.category });
  }
  for (const r of sql.selectObjects<{
    id: number;
    name: string;
    slot: string | null;
  }>(`SELECT id, name, slot FROM equips`)) {
    out.push({ id: r.id, name: r.name, entity: 'equip', category: r.slot });
  }
  for (const r of sql.selectObjects<{
    id: number;
    name: string;
    level: number | null;
  }>(`SELECT id, name, level FROM mobs WHERE name IS NOT NULL AND name <> ''`)) {
    out.push({
      id: r.id,
      name: r.name,
      entity: 'mob',
      category: r.level !== null ? `Lv ${r.level}` : null,
    });
  }
  for (const r of sql.selectObjects<{ id: number; name: string }>(
    `SELECT id, name FROM npcs WHERE name IS NOT NULL AND name <> ''`,
  )) {
    out.push({ id: r.id, name: r.name, entity: 'npc', category: null });
  }
  for (const r of sql.selectObjects<{
    id: number;
    name: string | null;
    street_name: string | null;
  }>(`SELECT id, name, street_name FROM maps WHERE name IS NOT NULL AND name <> ''`)) {
    out.push({
      id: r.id,
      name: r.name ?? `Map ${r.id}`,
      entity: 'map',
      category: r.street_name,
    });
  }
  for (const r of sql.selectObjects<{
    id: number;
    name: string;
    parent: string | null;
  }>(`SELECT id, name, parent FROM quests WHERE name IS NOT NULL AND name <> ''`)) {
    out.push({ id: r.id, name: r.name, entity: 'quest', category: r.parent });
  }
  return out;
}

export function getEntitySummariesByIds(
  sql: Sqlite,
  entityType: EntityKind,
  ids: readonly number[],
): EntitySummary[] {
  if (ids.length === 0) return [];
  const table = ENTITY_TABLES[entityType];
  if (!table) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = sql.selectObjects<{
    id: number;
    name: string | null;
  }>(`SELECT id, name FROM ${table} WHERE id IN (${placeholders})`, ids as (string | number)[]);
  return rows
    .filter((r) => r.name !== null && r.name !== '')
    .map((r) => ({ id: r.id, name: r.name as string }));
}
