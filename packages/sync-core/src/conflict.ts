// Server-ordered revision last-write-wins (docs/sync_design.md §7).
//
// The server is the arbiter of order (revisions are monotonic, assigned
// server-side), so client clock skew can never *corrupt* state — both devices
// converge to the same winner. `updated_at` is only a merge *hint*: which of
// two genuinely-concurrent edits to keep, with `origin_device` as the final
// deterministic tiebreak. This handler runs on the push 409 path (engine) and
// the pull path (the user-DB worker's `applyRemoteChanges`), so it is a pure
// function with no I/O.

import type { SyncChange, SyncEntity } from './types';
import { syncRecordMetaSchema } from './schemas';

export type ConflictWinner = 'local' | 'remote';

/** A record being merged: the local pending edit vs. the server's current. */
export interface ConflictInput {
  entity: SyncEntity;
  local: SyncChange;
  remote: SyncChange & { revision: number };
}

interface RecordFacts {
  deleted: boolean;
  /** When the change took effect; a delete competes at its `deleted_at`. */
  timestamp: number;
  originDevice: string;
  viewedAt: number;
}

function facts(change: SyncChange): RecordFacts {
  const meta = syncRecordMetaSchema.safeParse(change.payload);
  const updatedAt = meta.success ? meta.data.updated_at : 0;
  const deletedAt = meta.success && meta.data.deleted_at != null ? meta.data.deleted_at : 0;
  const deleted = change.op === 'delete';
  return {
    deleted,
    timestamp: deleted ? Math.max(updatedAt, deletedAt) : updatedAt,
    originDevice: meta.success ? meta.data.origin_device : '',
    viewedAt: meta.success && meta.data.viewed_at != null ? meta.data.viewed_at : 0,
  };
}

/** Pure last-write-wins on effective timestamp, deterministic device tiebreak,
 *  with the server winning a perfect tie (it is the source of truth). */
function lastWriteWins(local: RecordFacts, remote: RecordFacts): ConflictWinner {
  if (local.timestamp > remote.timestamp) return 'local';
  if (local.timestamp < remote.timestamp) return 'remote';
  if (local.originDevice > remote.originDevice) return 'local';
  return 'remote';
}

/**
 * Resolve a conflict between a local pending edit and the server's current
 * record. Per-entity overrides (§7): a collection delete is delete-wins, and a
 * recent always takes the most-recently-viewed timestamp. Everything else is
 * plain LWW.
 */
export function resolveConflict({ entity, local, remote }: ConflictInput): ConflictWinner {
  const l = facts(local);
  const r = facts(remote);

  // Recents converge on "most recently viewed wins", regardless of op — a fresh
  // view (upsert) beats an older prune (delete) and vice versa.
  if (entity === 'recent') {
    if (l.viewedAt > r.viewedAt) return 'local';
    if (l.viewedAt < r.viewedAt) return 'remote';
    return lastWriteWins(l, r);
  }

  // Deleting a collection is intentful and cascades; a delete on either side
  // wins over a concurrent edit so a removed collection stays removed.
  if (entity === 'collection' && l.deleted !== r.deleted) {
    return l.deleted ? 'local' : 'remote';
  }

  return lastWriteWins(l, r);
}
