import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserDbClient } from '@/db/user';
import { getDbClient, type EntityKind } from '@/db';

export interface RecentEntity {
  entity: EntityKind;
  id: number;
  name: string;
  viewedAt: number;
}

export interface RecentQuery {
  query: string;
  ranAt: number;
}

const ENTITIES_QK = ['recents', 'entities'] as const;
const QUERIES_QK = ['recents', 'queries'] as const;

/**
 * Fill in display names for recents that arrived without one. A recent's `name`
 * is a local-only column resolved from the game DB at view time and is
 * deliberately never synced (game-derived names aren't ours to replicate, and a
 * peer device may run a different game version), so a recent synced from another
 * device lands with an empty name. We resolve those here against this device's
 * own game DB — the authoritative source — grouped by entity kind, and fall back
 * to `#<id>` for anything not in this library. Locally-tracked names are left
 * untouched (no extra lookup, no flash).
 */
async function resolveRecentNames(
  pending: Promise<RecentEntity[]>,
): Promise<RecentEntity[]> {
  const rows = await pending;
  const missing = rows.filter((r) => !r.name);
  if (missing.length === 0) return rows;

  const idsByEntity = new Map<EntityKind, number[]>();
  for (const r of missing) {
    const ids = idsByEntity.get(r.entity);
    if (ids) ids.push(r.id);
    else idsByEntity.set(r.entity, [r.id]);
  }

  const gameDb = getDbClient();
  const resolved = new Map<string, string>();
  await Promise.all(
    [...idsByEntity].map(async ([entity, ids]) => {
      // A malformed/unknown kind from an old ref shouldn't fail the whole list.
      const summaries = await gameDb.getEntitySummariesByIds(entity, ids).catch(() => []);
      for (const s of summaries) resolved.set(`${entity}:${s.id}`, s.name);
    }),
  );

  return rows.map((r) =>
    r.name ? r : { ...r, name: resolved.get(`${r.entity}:${r.id}`) ?? `#${r.id}` },
  );
}

export function useRecentEntities() {
  const db = useMemo(() => getUserDbClient(), []);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ENTITIES_QK,
    queryFn: () => resolveRecentNames(db.listRecentEntities() as Promise<RecentEntity[]>),
    staleTime: Infinity,
  });

  const trackM = useMutation({
    mutationFn: async (input: Omit<RecentEntity, 'viewedAt'>) => {
      await db.trackRecentEntity(input.entity, input.id, input.name);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENTITIES_QK });
    },
  });

  const clear = useCallback(async () => {
    await db.clearRecents('entity');
    qc.setQueryData(ENTITIES_QK, []);
  }, [db, qc]);

  return {
    items: q.data ?? [],
    track: trackM.mutate,
    clear,
  };
}

export function useRecentQueries() {
  const db = useMemo(() => getUserDbClient(), []);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QUERIES_QK,
    queryFn: () => db.listRecentQueries() as Promise<RecentQuery[]>,
    staleTime: Infinity,
  });

  const trackM = useMutation({
    mutationFn: async (query: string) => {
      await db.trackRecentQuery(query);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERIES_QK });
    },
  });

  const clear = useCallback(async () => {
    await db.clearRecents('query');
    qc.setQueryData(QUERIES_QK, []);
  }, [db, qc]);

  return {
    items: q.data ?? [],
    track: trackM.mutate,
    clear,
  };
}
