// Zod schemas for whatever a provider returns — it may be a remote store, so the
// engine validates before acting. Row contents stay loose; the local layer that
// writes actual columns coerces per-column.

import { z } from 'zod';
import { SYNC_ENTITIES, ENTITY_KEY_COLUMNS, type RemoteRow, type SyncEntity } from './types';

/**
 * Exchanged via `SyncProvider.hello()`. The remote store rejects clients below
 * its `minClientRevision` so an incompatible client is told to refresh rather
 * than corrupting data.
 *
 * v3: the store became relational — records are rows keyed by their natural key,
 * push is an unconditional upsert, and pull pages on a timestamp cursor. Not
 * compatible with v2, hence the matching `minClientRevision`.
 */
export const PROTOCOL_VERSION = 3;

export const syncEntitySchema = z.enum(SYNC_ENTITIES);
export const syncOpSchema = z.enum(['upsert', 'delete']);

export const remoteRowSchema = z.record(z.string(), z.unknown());

export const taggedRowSchema = z.object({
  entity: syncEntitySchema,
  row: remoteRowSchema,
  seq: z.number().int().nonnegative(),
  serverTime: z.string().min(1),
});

export const upsertResultSchema = z.object({
  applied: z.array(
    z.object({
      key: z.string().min(1),
      seq: z.number().int().nonnegative(),
    }),
  ),
  nameCollisions: z.array(
    z.object({
      key: z.string().min(1),
      entity: syncEntitySchema,
      row: remoteRowSchema,
    }),
  ),
});

export const fetchPageSchema = z.object({
  rows: z.array(taggedRowSchema),
  cursor: z.string(),
  complete: z.boolean(),
});

export const protocolHandshakeSchema = z.object({
  protocolVersion: z.number().int().positive(),
  minClientRevision: z.number().int().positive(),
});

/** A unit separator, so a value containing the delimiter cannot forge another
 *  record's identity. */
const KEY_SEPARATOR = '\u001f';

export function recordKey(entity: SyncEntity, row: RemoteRow): string {
  const cols: readonly string[] = ENTITY_KEY_COLUMNS[entity];
  return cols.map((c) => String(row[c] ?? '')).join(KEY_SEPARATOR);
}

export function splitRecordKey(key: string): string[] {
  return key.split(KEY_SEPARATOR);
}
