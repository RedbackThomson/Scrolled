// TanStack Query hooks for pinned searches in the user DB. Mirrors the
// `useCollections` patterns: all keys under `['user','pinned',...]` so a
// broad invalidation after any mutation refetches the list.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  getUserDbClient,
  type CreatePinnedSearchInput,
  type PinnedSearchRecord,
  type UpdatePinnedSearchPatch,
} from '@/db/user';

const ROOT_KEY = ['user', 'pinned'] as const;

export function pinnedListKey() {
  return [...ROOT_KEY, 'list'] as const;
}

export function usePinnedSearches(): UseQueryResult<PinnedSearchRecord[]> {
  const db = getUserDbClient();
  return useQuery({
    queryKey: pinnedListKey(),
    queryFn: () => db.listPinnedSearches(),
  });
}

export function useCreatePinnedSearch(): UseMutationResult<
  PinnedSearchRecord,
  Error,
  CreatePinnedSearchInput
> {
  const qc = useQueryClient();
  const db = getUserDbClient();
  return useMutation({
    mutationFn: (input) => db.createPinnedSearch(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ROOT_KEY });
    },
  });
}

export function useUpdatePinnedSearch(): UseMutationResult<
  PinnedSearchRecord,
  Error,
  { id: number; patch: UpdatePinnedSearchPatch }
> {
  const qc = useQueryClient();
  const db = getUserDbClient();
  return useMutation({
    mutationFn: ({ id, patch }) => db.updatePinnedSearch(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ROOT_KEY });
    },
  });
}

export function useDeletePinnedSearch(): UseMutationResult<void, Error, number> {
  const qc = useQueryClient();
  const db = getUserDbClient();
  return useMutation({
    mutationFn: (id) => db.deletePinnedSearch(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ROOT_KEY });
    },
  });
}
