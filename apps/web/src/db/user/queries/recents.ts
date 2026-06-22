// Recently-viewed entities and recent search queries, in the user DB
// (docs/sync_design.md §6.3). Replaces the old idb-keyval store.
//
// Both kinds live in one `recents` table keyed by (kind, ref). Re-viewing an
// entity coalesces onto its existing row (an `updated_at`/`viewed_at` bump,
// LWW per ref), and the list stays capped by local pruning — pruned rows are
// captured as delete tombstones so the cap converges across devices later.

import type { Sqlite, Row } from '@scrolled/game-db/db/sqlite';
import { recordDelete, recordUpsert } from './sync';

const MAX_ENTITIES = 30;
const MAX_QUERIES = 15;

const RECENT_WHERE = 'kind = ? AND ref = ?';

export interface RecentEntityRow {
  entity: string;
  id: number;
  name: string;
  viewedAt: number;
}

export interface RecentQueryRow {
  query: string;
  ranAt: number;
}

function entityRef(entity: string, id: number): string {
  return `${entity}:${id}`;
}

function parseEntityRef(ref: string): { entity: string; id: number } | null {
  const sep = ref.lastIndexOf(':');
  if (sep <= 0) return null;
  const entity = ref.slice(0, sep);
  const id = Number(ref.slice(sep + 1));
  if (!Number.isFinite(id)) return null;
  return { entity, id };
}

export function listRecentEntities(db: Sqlite): RecentEntityRow[] {
  const rows = db.selectObjects<Row>(
    `SELECT ref, name, viewed_at FROM recents
     WHERE kind = 'entity' AND deleted_at IS NULL
     ORDER BY viewed_at DESC`,
  );
  const out: RecentEntityRow[] = [];
  for (const r of rows) {
    const parsed = parseEntityRef(String(r.ref));
    if (!parsed) continue;
    out.push({
      entity: parsed.entity,
      id: parsed.id,
      name: r.name == null ? '' : String(r.name),
      viewedAt: Number(r.viewed_at),
    });
  }
  return out;
}

export function listRecentQueries(db: Sqlite): RecentQueryRow[] {
  const rows = db.selectObjects<Row>(
    `SELECT ref, viewed_at FROM recents
     WHERE kind = 'query' AND deleted_at IS NULL
     ORDER BY viewed_at DESC`,
  );
  return rows.map((r) => ({ query: String(r.ref), ranAt: Number(r.viewed_at) }));
}

function track(
  db: Sqlite,
  kind: 'entity' | 'query',
  ref: string,
  name: string | null,
  viewedAt: number,
  cap: number,
): void {
  db.transaction(() => {
    db.exec(
      `INSERT INTO recents (kind, ref, name, viewed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (kind, ref) DO UPDATE SET
         name      = excluded.name,
         viewed_at = excluded.viewed_at`,
      [kind, ref, name, viewedAt],
    );
    recordUpsert(db, 'recent', RECENT_WHERE, [kind, ref]);

    const overflow = db
      .selectObjects<{ ref: string }>(
        `SELECT ref FROM recents
         WHERE kind = ? AND deleted_at IS NULL
         ORDER BY viewed_at DESC, ref
         LIMIT -1 OFFSET ?`,
        [kind, cap],
      )
      .map((r) => String(r.ref));
    for (const staleRef of overflow) {
      recordDelete(db, 'recent', RECENT_WHERE, [kind, staleRef]);
      db.exec('DELETE FROM recents WHERE kind = ? AND ref = ?', [kind, staleRef]);
    }
  });
}

export function trackRecentEntity(
  db: Sqlite,
  entity: string,
  id: number,
  name: string,
  viewedAt: number = Date.now(),
): void {
  track(db, 'entity', entityRef(entity, id), name, viewedAt, MAX_ENTITIES);
}

export function trackRecentQuery(
  db: Sqlite,
  query: string,
  ranAt: number = Date.now(),
): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  track(db, 'query', trimmed, null, ranAt, MAX_QUERIES);
}

export function clearRecents(db: Sqlite, kind: 'entity' | 'query'): void {
  db.transaction(() => {
    const refs = db
      .selectObjects<{ ref: string }>(
        'SELECT ref FROM recents WHERE kind = ? AND deleted_at IS NULL',
        [kind],
      )
      .map((r) => String(r.ref));
    for (const ref of refs) {
      recordDelete(db, 'recent', RECENT_WHERE, [kind, ref]);
      db.exec('DELETE FROM recents WHERE kind = ? AND ref = ?', [kind, ref]);
    }
  });
}
