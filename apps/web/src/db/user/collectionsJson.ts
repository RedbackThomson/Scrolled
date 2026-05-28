// JSON shape for exporting / importing collections.
//
// Two variants share one discriminated union so an import file can carry
// either a single collection (download from a detail page) or the full
// library (download from the index page). Validation lives on the import
// path via zod; the writer side just builds plain objects.

import { z } from 'zod';
import { COLLECTION_ENTITY_TYPES } from './types';

export const COLLECTIONS_JSON_VERSION = 1 as const;

export const collectionMemberJsonSchema = z.object({
  entityType: z.enum(COLLECTION_ENTITY_TYPES),
  entityId: z.number().int(),
  note: z.string().nullable().optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
  done: z.boolean().optional(),
});

export const collectionBundleSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  /** Pinned on import. Optional so pre-pin export files still validate. */
  pinned: z.boolean().optional(),
  /** Relative position within the pinned grid at export time. Optional;
   *  the importer re-derives a contiguous order. */
  pinnedPosition: z.number().int().nullable().optional(),
  members: z.array(collectionMemberJsonSchema),
});

export const pinnedSearchJsonSchema = z.object({
  name: z.string().min(1),
  entity: z.enum(COLLECTION_ENTITY_TYPES),
  params: z.record(z.string()),
});

export const uiPrefJsonSchema = z.object({
  key: z.string().min(1),
  /** Already-serialized JSON string; the consuming widget owns the
   *  shape. */
  value: z.string(),
});

export const collectionsExportSchema = z.discriminatedUnion('kind', [
  z.object({
    version: z.literal(COLLECTIONS_JSON_VERSION),
    kind: z.literal('collection'),
    collection: collectionBundleSchema,
  }),
  z.object({
    version: z.literal(COLLECTIONS_JSON_VERSION),
    kind: z.literal('all'),
    collections: z.array(collectionBundleSchema),
    /** Pinned searches travel with the full-library export. Optional so
     *  pre-pinned-search export files still validate. */
    pinnedSearches: z.array(pinnedSearchJsonSchema).optional(),
    /** UI preferences (home layout, etc.) ride the full-library export
     *  so a backup round-trips dashboard customization. Optional so
     *  pre-ui-prefs export files still validate. */
    uiPrefs: z.array(uiPrefJsonSchema).optional(),
  }),
]);

export type CollectionMemberJson = z.infer<typeof collectionMemberJsonSchema>;
export type CollectionBundleJson = z.infer<typeof collectionBundleSchema>;
export type PinnedSearchJson = z.infer<typeof pinnedSearchJsonSchema>;
export type UiPrefJson = z.infer<typeof uiPrefJsonSchema>;
export type CollectionsExportJson = z.infer<typeof collectionsExportSchema>;

/**
 * What to do when an imported collection's `name` collides with an
 * existing one.
 *
 *   - `merge`  — re-use the existing collection; INSERT-OR-IGNORE every
 *                imported member into it. Existing description / icon
 *                are preserved.
 *   - `rename` — create a new collection with a "(imported)" /
 *                "(imported N)" suffix and import members into that.
 *   - `skip`   — leave the existing collection alone, drop the import.
 */
export type ImportConflictMode = 'merge' | 'rename' | 'skip';

export interface ImportReport {
  createdCollections: number;
  mergedCollections: number;
  renamedCollections: number;
  skippedCollections: number;
  addedMembers: number;
  /** Member rows skipped because the same (type, id) is already in the
   *  target collection. Only meaningful for `merge` mode. */
  skippedMembers: number;
  /** Names of imported collections after conflict resolution; useful
   *  for the post-import status toast. */
  importedNames: string[];
  /** Pinned searches imported (kind = 'all' only). Name collisions on
   *  pinned searches always skip — no merge mode for these. */
  importedPinnedSearches: number;
  skippedPinnedSearches: number;
  /** UI prefs imported (overwrites existing keys, since these are
   *  per-user settings — the freshest write should win). */
  importedUiPrefs: number;
}
