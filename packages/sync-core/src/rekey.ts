// Merging records two devices created independently.
//
// Collections, groups and pinned searches carry a client-minted key so they can
// be created offline and referenced before the remote store has seen them. Two
// devices can therefore mint different keys for what the user considers one
// record — the seeded "Favourites", or "Bosses" made on a laptop and a phone.
//
// The unique-name index rejects the second one, which is how we learn they are
// the same record. Adopting the existing key and re-pushing merges them; members
// union for free because they are keyed by entity rather than by a minted id.

import {
  ENTITY_UNIQUE_NAME,
  type RemoteRow,
  type SyncBackend,
  type SyncEntity,
  type SyncProvider,
  type UpsertResult,
} from './types';

export interface NameCollision {
  key: string;
  entity: SyncEntity;
  row: RemoteRow;
}

/**
 * Returns true when the local DB was rekeyed and the caller should push again.
 *
 * False means the remote store has no row under that name after all — a race
 * with another device's delete. The change stays queued for the next cycle, and
 * the snapshot reconcile is the backstop if it keeps failing.
 */
export async function resolveNameCollision(
  provider: SyncProvider,
  backend: SyncBackend,
  collision: NameCollision,
): Promise<boolean> {
  const unique = ENTITY_UNIQUE_NAME[collision.entity as keyof typeof ENTITY_UNIQUE_NAME] as
    | { column: string; scope: readonly string[] }
    | undefined;
  if (!unique) return false;

  const where: RemoteRow = { [unique.column]: collision.row[unique.column] };
  for (const col of unique.scope) where[col] = collision.row[col];

  const existing = await provider.findByUnique(collision.entity, where);
  const canonical = typeof existing?.key === 'string' ? existing.key : null;
  if (!canonical || canonical === collision.key) return false;

  await backend.rekeyLocal(collision.entity, collision.key, canonical);
  return true;
}

export async function resolveCollisions(
  provider: SyncProvider,
  backend: SyncBackend,
  result: UpsertResult,
): Promise<boolean> {
  let rekeyed = false;
  for (const collision of result.nameCollisions) {
    if (await resolveNameCollision(provider, backend, collision)) rekeyed = true;
  }
  return rekeyed;
}
