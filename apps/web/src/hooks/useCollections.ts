// TanStack Query hooks for the user-data DB.
//
// All keys live under `['user', 'collections', ...]` so a broad invalidation
// after any mutation refetches everything Collections-related without
// touching game-data queries. Hot paths (membership lookups for a specific
// entity) use a targeted key so the popover doesn't re-fetch the whole list
// every time a checkbox toggles.

import { useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  getUserDbClient,
  type CollectionEntityType,
  type CollectionMember,
  type CollectionRecord,
  type CollectionsExportJson,
  type CreateCollectionInput,
  type EntityRef,
  type ImportConflictMode,
  type ImportReport,
  type MembershipBadge,
  type UpdateCollectionPatch,
  type UpdateMemberPatch,
} from '@/db/user';

const ROOT_KEY = ['user', 'collections'] as const;

export function useUserDb() {
  return useMemo(() => getUserDbClient(), []);
}

export function collectionsListKey() {
  return [...ROOT_KEY, 'list'] as const;
}
export function collectionDetailKey(id: number) {
  return [...ROOT_KEY, 'detail', id] as const;
}
export function collectionMembersKey(id: number) {
  return [...ROOT_KEY, 'members', id] as const;
}
export function membershipKey(entityType: CollectionEntityType, entityId: number) {
  return [...ROOT_KEY, 'membership', entityType, entityId] as const;
}

export function useCollectionsList(): UseQueryResult<CollectionRecord[]> {
  const db = useUserDb();
  return useQuery({
    queryKey: collectionsListKey(),
    queryFn: () => db.listCollections(),
  });
}

export function useCollection(id: number | null): UseQueryResult<CollectionRecord | null> {
  const db = useUserDb();
  return useQuery({
    queryKey: collectionDetailKey(id ?? -1),
    queryFn: () => (id == null ? Promise.resolve(null) : db.getCollection(id)),
    enabled: id != null,
  });
}

export function useCollectionMembers(id: number | null): UseQueryResult<CollectionMember[]> {
  const db = useUserDb();
  return useQuery({
    queryKey: collectionMembersKey(id ?? -1),
    queryFn: () => (id == null ? Promise.resolve([]) : db.listMembers(id)),
    enabled: id != null,
  });
}

export function useMembership(
  entityType: CollectionEntityType,
  entityId: number,
): UseQueryResult<MembershipBadge[]> {
  const db = useUserDb();
  return useQuery({
    queryKey: membershipKey(entityType, entityId),
    queryFn: () => db.listMembershipsFor(entityType, entityId),
    staleTime: 30_000,
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ROOT_KEY });
}

export function useCreateCollection(): UseMutationResult<
  CollectionRecord,
  Error,
  CreateCollectionInput
> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CreateCollectionInput) => db.createCollection(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCollection(): UseMutationResult<
  CollectionRecord,
  Error,
  { id: number; patch: UpdateCollectionPatch }
> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, patch }) => db.updateCollection(id, patch),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCollection(): UseMutationResult<void, Error, number> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) => db.deleteCollection(id),
    onSuccess: () => invalidate(),
  });
}

export function useSetCollectionPinned(): UseMutationResult<
  CollectionRecord,
  Error,
  { id: number; pinned: boolean }
> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, pinned }) => db.setCollectionPinned(id, pinned),
    onSuccess: () => invalidate(),
  });
}

export interface ToggleMembershipArgs {
  collectionId: number;
  entityType: CollectionEntityType;
  entityId: number;
  member: boolean;
}

export function useToggleMembership(): UseMutationResult<void, Error, ToggleMembershipArgs> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ collectionId, entityType, entityId, member }) => {
      if (member) await db.addMember(collectionId, entityType, entityId);
      else await db.removeMember(collectionId, entityType, entityId);
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMember(): UseMutationResult<
  void,
  Error,
  {
    collectionId: number;
    entityType: CollectionEntityType;
    entityId: number;
    patch: UpdateMemberPatch;
  }
> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ collectionId, entityType, entityId, patch }) =>
      db.updateMember(collectionId, entityType, entityId, patch),
    onSuccess: () => invalidate(),
  });
}

export function useRemoveMember(): UseMutationResult<
  void,
  Error,
  { collectionId: number; entityType: CollectionEntityType; entityId: number }
> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ collectionId, entityType, entityId }) =>
      db.removeMember(collectionId, entityType, entityId),
    onSuccess: () => invalidate(),
  });
}

export function useBulkAddMembers(): UseMutationResult<
  { added: number; skipped: number },
  Error,
  { collectionId: number; refs: readonly EntityRef[] }
> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ collectionId, refs }) => db.bulkAddMembers(collectionId, refs),
    onSuccess: () => invalidate(),
  });
}

export function useExportCollectionJson(): UseMutationResult<CollectionsExportJson, Error, number> {
  const db = useUserDb();
  return useMutation<CollectionsExportJson, Error, number>({
    mutationFn: (id) => db.exportCollectionJson(id),
  });
}

export function useExportAllJson(): UseMutationResult<CollectionsExportJson, Error, void> {
  const db = useUserDb();
  return useMutation<CollectionsExportJson, Error, void>({
    mutationFn: () => db.exportAllJson(),
  });
}

export function useImportJson(): UseMutationResult<
  ImportReport,
  Error,
  { payload: unknown; conflict: ImportConflictMode }
> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ payload, conflict }) => db.importJson(payload, conflict),
    onSuccess: () => invalidate(),
  });
}

export function useExportUserDbBytes(): UseMutationResult<Uint8Array, Error, void> {
  const db = useUserDb();
  return useMutation({
    mutationFn: () => db.exportBytes(),
  });
}

export function useImportUserDbBytes(): UseMutationResult<
  { backend: 'opfs' | 'memory'; schemaVersion: number },
  Error,
  Uint8Array
> {
  const db = useUserDb();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (bytes: Uint8Array) => db.importBytes(bytes),
    onSuccess: () => invalidate(),
  });
}
