// Zod schemas for the wire contract (docs/sync_design.md §8, §15). Whatever a
// provider returns crosses a trust boundary — it may be a remote server — so
// the engine validates `PushResult`/`PullResult` against these before acting on
// them. Record payloads stay `unknown` here (their per-entity shape is decoded
// closer to the data); what we pin down is the envelope every change carries.

import { z } from 'zod';
import { SYNC_ENTITIES } from './types';

/**
 * The wire protocol version, exchanged via `SyncProvider.hello()`. A server
 * rejects clients below its `minClientRevision`; the client surfaces a clear
 * "please refresh" rather than corrupting data. Bump on any incompatible change
 * to the change envelope or push/pull semantics.
 */
export const PROTOCOL_VERSION = 1;

export const syncEntitySchema = z.enum(SYNC_ENTITIES);
export const syncOpSchema = z.enum(['upsert', 'delete']);

export const syncChangeSchema = z.object({
  entity: syncEntitySchema,
  uuid: z.string().min(1),
  op: syncOpSchema,
  payload: z.unknown(),
  baseRevision: z.number().int().nonnegative(),
  idempotency: z.string().min(1),
});

export const serverChangeSchema = syncChangeSchema.extend({
  revision: z.number().int().positive(),
  serverSeq: z.number().int().positive(),
});

export const pushResultSchema = z.object({
  applied: z.array(
    z.object({
      uuid: z.string().min(1),
      revision: z.number().int().positive(),
      serverSeq: z.number().int().positive(),
    }),
  ),
  conflicts: z.array(
    z.object({
      uuid: z.string().min(1),
      remote: syncChangeSchema.extend({ revision: z.number().int().nonnegative() }),
    }),
  ),
});

export const pullResultSchema = z.object({
  changes: z.array(serverChangeSchema),
  nextCursor: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export const protocolHandshakeSchema = z.object({
  protocolVersion: z.number().int().positive(),
  minClientRevision: z.number().int().positive(),
});

/**
 * The sync columns common to every record payload. The conflict handler reads
 * these to compare a local vs. remote record; `safeParse` with sensible
 * fallbacks keeps a malformed payload from throwing mid-merge. `recents` rows
 * additionally carry `viewed_at`, used by that entity's conflict override.
 */
export const syncRecordMetaSchema = z
  .object({
    updated_at: z.coerce.number().catch(0),
    origin_device: z.string().catch(''),
    viewed_at: z.coerce.number().optional(),
    deleted_at: z.coerce.number().nullish(),
  })
  .passthrough();

export type SyncRecordMeta = z.infer<typeof syncRecordMetaSchema>;
