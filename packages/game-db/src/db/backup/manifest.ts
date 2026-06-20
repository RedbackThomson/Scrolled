// Manifest for the `.scrolled-backup` container (see ./format.ts).
//
// The manifest rides inside the archive as `manifest.json` and describes every
// database blob it carries: integrity hashes plus the versions needed to decide
// — before touching the live database — whether the backup can be imported.

import { z } from 'zod';
import {
  evaluateGameDataImport,
  type GameDataBlockKind,
  type GameDataImportDecision,
} from '../importCompat';

export const BACKUP_FORMAT = 'scrolled-backup';
export const BACKUP_FORMAT_VERSION = 1;

const databaseEntrySchema = z.object({
  /** Archive member holding the raw SQLite bytes. */
  file: z.string(),
  byteLength: z.number().int().nonnegative(),
  /** Lowercase SHA-256 hex of the blob, verified on import. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  schemaVersion: z.number().int().nonnegative(),
});

const gameEntrySchema = databaseEntrySchema.extend({
  /** Extracted-data contract the blob was produced under (db/dataVersion.ts). */
  dataRevision: z.number().int().nonnegative(),
  /** The lowest revision the *producing* build could read. Informational. */
  minimumSupportedDataRevision: z.number().int().nonnegative(),
});

export const backupManifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  createdAt: z.string(),
  /** Best-effort build provenance; absent in forks/dev where it isn't injected. */
  app: z.object({ version: z.string().optional(), commit: z.string().optional() }).optional(),
  databases: z.object({
    game: gameEntrySchema.optional(),
    user: databaseEntrySchema.optional(),
  }),
});

export type BackupManifest = z.infer<typeof backupManifestSchema>;
export type BackupGameEntry = z.infer<typeof gameEntrySchema>;
export type BackupDatabaseEntry = z.infer<typeof databaseEntrySchema>;

/** Backup-flavored aliases for the shared game-data import decision (see ../importCompat). */
export type BackupBlockKind = GameDataBlockKind;
export type BackupImportDecision = GameDataImportDecision;

/**
 * Thrown when an import is rejected for incompatibility, so callers can tell it
 * apart from a transient failure (offer "update the app", not "retry").
 */
export class BackupIncompatibleError extends Error {
  constructor(
    readonly kind: BackupBlockKind,
    message: string,
  ) {
    super(message);
    this.name = 'BackupIncompatibleError';
  }
}

/**
 * Decide whether a backup may be imported, judged against *this* build's
 * thresholds. User data carries no data revision, so only the game section is
 * gated — its migrations bring it current.
 */
export function evaluateBackupImport(manifest: BackupManifest): BackupImportDecision {
  return evaluateGameDataImport(manifest.databases.game);
}
