import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserDbClient } from '@/db/user';
import type { EntityKind } from '@/db';

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

export function useRecentEntities() {
  const db = useMemo(() => getUserDbClient(), []);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ENTITIES_QK,
    queryFn: () => db.listRecentEntities() as Promise<RecentEntity[]>,
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
