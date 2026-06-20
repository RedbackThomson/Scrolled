// --- Alpha-only legacy import path ------------------------------------------
//
// Before the `.scrolled-backup` format, backups were bare SQLite dumps written
// straight from `exportBytes()`. We still accept those so existing alpha users
// don't lose access to backups they already made — but a raw dump carries no
// manifest, so we can't gate it on data revision and have to sniff which
// database it is.
//
// This whole module and its single call site in lib/useBackup.ts are slated for
// removal at GA. Deleting the file should take all legacy handling with it.

const SQLITE_MAGIC = 'SQLite format 3\0';

export function looksLikeRawSqlite(bytes: Uint8Array): boolean {
  if (bytes.byteLength < SQLITE_MAGIC.length) return false;
  for (let i = 0; i < SQLITE_MAGIC.length; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Guess whether a raw dump is the game or user database. SQLite stores each
 * table's `CREATE TABLE` text verbatim in its schema pages near the start of
 * the file, so scanning the head for a table name unique to one database is
 * enough to tell them apart. Returns null when neither sentinel is found.
 */
export function classifyRawSqlite(bytes: Uint8Array): 'game' | 'user' | null {
  const head = bytes.subarray(0, Math.min(bytes.byteLength, 1_048_576));
  const text = new TextDecoder('latin1').decode(head);
  if (text.includes('collection_members')) return 'user';
  if (text.includes('app_meta') || text.includes('equips')) return 'game';
  return null;
}
