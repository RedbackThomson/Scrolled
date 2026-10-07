import type { Sqlite } from '../sqlite';
import type { ColumnFilter, ColumnHistogram, FacetSource } from '../types';
import {
  EQUIP_FILTER,
  ITEM_FILTER,
  MAP_FILTER,
  MOB_FILTER,
  NPC_FILTER,
  QUEST_CHAIN_FILTER,
  QUEST_FILTER,
  SKILL_FILTER,
  applyFilters,
  type FilterSpec,
} from './shared/filters';

interface Source {
  table: string;
  from: string;
  /** Conditions every row of the list page satisfies before any filter */
  base: string[];
  allow: Record<string, FilterSpec>;
}

// Each source mirrors its list query's FROM and fixed WHERE so counts agree with the page.
const SOURCES: Record<FacetSource, Source> = {
  item: {
    table: 'items',
    from: 'items LEFT JOIN consumable_specs cs ON cs.item_id = items.id',
    base: [],
    allow: ITEM_FILTER,
  },
  equip: { table: 'equips', from: 'equips', base: ['equip_type IS NULL'], allow: EQUIP_FILTER },
  weapon: {
    table: 'equips',
    from: 'equips',
    base: ['equip_type IS NOT NULL'],
    allow: EQUIP_FILTER,
  },
  mob: { table: 'mobs', from: 'mobs', base: [], allow: MOB_FILTER },
  npc: { table: 'npcs', from: 'npcs', base: [], allow: NPC_FILTER },
  map: { table: 'maps', from: 'maps', base: [], allow: MAP_FILTER },
  quest: { table: 'quests', from: 'quests', base: [], allow: QUEST_FILTER },
  questChain: { table: 'quest_chains', from: 'quest_chains', base: [], allow: QUEST_CHAIN_FILTER },
  skill: { table: 'skills', from: 'skills', base: [], allow: SKILL_FILTER },
};

function whereClause(
  src: Source,
  filters: Record<string, ColumnFilter>,
  extra: string[] = [],
): { clause: string; params: (string | number)[] } {
  const where = [...src.base, ...extra];
  const params: (string | number)[] = [];
  applyFilters(src.allow, filters, where, params);
  return { clause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** Every matching row's id, in id order — what "select all" resolves to. */
export function matchingIds(
  sql: Sqlite,
  source: FacetSource,
  filters: Record<string, ColumnFilter>,
): number[] {
  const src = SOURCES[source];
  const { clause, params } = whereClause(src, filters);
  const idCol = `${src.table}.id`;
  return sql
    .selectObjects<{
      id: number;
    }>(`SELECT ${idCol} AS id FROM ${src.from} ${clause} ORDER BY ${idCol}`, params.length > 0 ? params : undefined)
    .map((r) => Number(r.id));
}

/** Row count for each filter set, in order. One call serves a popover's per-value counts. */
export function countMatchingMany(
  sql: Sqlite,
  source: FacetSource,
  filterSets: readonly Record<string, ColumnFilter>[],
): number[] {
  const src = SOURCES[source];
  return sql.transaction(() =>
    filterSets.map((filters) => {
      const { clause, params } = whereClause(src, filters);
      return Number(
        sql.selectValue(
          `SELECT COUNT(*) FROM ${src.from} ${clause}`,
          params.length > 0 ? params : undefined,
        ) ?? 0,
      );
    }),
  );
}

/**
 * Distribution of a number column under `filters`, in at most `bins` equal-width
 * bins from the column's minimum. Integer columns get integer-width bins so a
 * bin never splits a level. Null when the column isn't numeric or has no values.
 */
export function columnHistogram(
  sql: Sqlite,
  source: FacetSource,
  columnId: string,
  bins: number,
  filters: Record<string, ColumnFilter>,
): ColumnHistogram | null {
  const src = SOURCES[source];
  const spec = src.allow[columnId];
  if (!spec || spec.type !== 'number' || bins < 1) return null;
  const col = spec.col;
  const { clause, params } = whereClause(src, filters, [`${col} IS NOT NULL`]);
  const bind = params.length > 0 ? params : undefined;
  return sql.transaction(() => {
    const range = sql.selectObject<{ lo: number | null; hi: number | null }>(
      `SELECT MIN(${col}) AS lo, MAX(${col}) AS hi FROM ${src.from} ${clause}`,
      bind,
    );
    if (range?.lo == null || range.hi == null) return null;
    const min = range.lo;
    const max = range.hi;
    const integral = Number.isInteger(min) && Number.isInteger(max);
    const width = integral
      ? Math.max(1, Math.ceil((max - min + 1) / bins))
      : (max - min) / bins || 1;
    const count = integral ? Math.min(bins, Math.ceil((max - min + 1) / width)) : bins;
    const rows = sql.selectObjects<{ b: number; n: number }>(
      `SELECT MIN(CAST((${col} - ?) / ? AS INTEGER), ?) AS b, COUNT(*) AS n
         FROM ${src.from} ${clause}
        GROUP BY b`,
      [min, width, count - 1, ...params],
    );
    const out = new Array<number>(count).fill(0);
    for (const r of rows) out[Number(r.b)] = Number(r.n);
    return { min, max, binWidth: width, bins: out };
  });
}
