import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import type { EntityKind } from '@/db';

const ENTITIES_KEY = 'mge.recents.entities';
const QUERIES_KEY = 'mge.recents.queries';
const MAX_ENTITIES = 30;
const MAX_QUERIES = 15;

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
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ENTITIES_QK,
    queryFn: async () => (await get<RecentEntity[]>(ENTITIES_KEY)) ?? [],
    staleTime: Infinity,
  });

  const trackM = useMutation({
    mutationFn: async (input: Omit<RecentEntity, 'viewedAt'>) => {
      const current = (await get<RecentEntity[]>(ENTITIES_KEY)) ?? [];
      const filtered = current.filter(
        (r) => !(r.entity === input.entity && r.id === input.id),
      );
      const next = [{ ...input, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ENTITIES);
      await set(ENTITIES_KEY, next);
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(ENTITIES_QK, next);
    },
  });

  const clear = useCallback(async () => {
    await set(ENTITIES_KEY, []);
    qc.setQueryData(ENTITIES_QK, []);
  }, [qc]);

  return {
    items: q.data ?? [],
    track: trackM.mutate,
    clear,
  };
}

export function useRecentQueries() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QUERIES_QK,
    queryFn: async () => (await get<RecentQuery[]>(QUERIES_KEY)) ?? [],
    staleTime: Infinity,
  });

  const trackM = useMutation({
    mutationFn: async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return (await get<RecentQuery[]>(QUERIES_KEY)) ?? [];
      const current = (await get<RecentQuery[]>(QUERIES_KEY)) ?? [];
      const filtered = current.filter((r) => r.query !== trimmed);
      const next = [{ query: trimmed, ranAt: Date.now() }, ...filtered].slice(
        0,
        MAX_QUERIES,
      );
      await set(QUERIES_KEY, next);
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(QUERIES_QK, next);
    },
  });

  const clear = useCallback(async () => {
    await set(QUERIES_KEY, []);
    qc.setQueryData(QUERIES_QK, []);
  }, [qc]);

  return {
    items: q.data ?? [],
    track: trackM.mutate,
    clear,
  };
}
