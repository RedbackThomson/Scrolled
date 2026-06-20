// Manifest for the `.scrolled-backup` container (see ./format.ts).
//
// The manifest rides inside the archive as `manifest.json` and describes every
// database blob it carries: integrity hashes plus the versions needed to decide
// — before touching the live database — whether the backup can be imported.

import { z } from 'zod';
import { CURRENT_DATA_REVISION, MINIMUM_SUPPORTED_DATA_REVISION } from '@/db/dataVersion';
import { LATEST_SCHEMA_VERSION } from '@/db/migrations';

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

/**
 * Why an import is blocked:
 *   - `data-too-old`: the data predates what this build can read — a newer
 *     dataset (or a rebuild from source) is needed.
 *   - `app-too-old`: the data was produced by a newer build — the app must be
 *     updated before it can be used.
 */
export type BackupBlockKind = 'data-too-old' | 'app-too-old';

export interface BackupImportDecision {
  /** When true, `reason` explains why the import must not proceed. */
  blocked: boolean;
  reason?: string;
  /** Set when `blocked` — lets the UI choose between "update app" and "newer data". */
  kind?: BackupBlockKind;
  /** Non-blocking notices to surface after a successful import. */
  warnings: string[];
}

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
 * thresholds. Pure so it can be unit-tested without a database. The check is
 * two-sided:
 *   - Too old: game data below `MINIMUM_SUPPORTED_DATA_REVISION` is unreadable
 *     and blocked; below `CURRENT_DATA_REVISION` imports with a "re-run setup"
 *     nudge.
 *   - Too new: a schema beyond `LATEST_SCHEMA_VERSION` (migrations are
 *     forward-only) or a data revision beyond `CURRENT_DATA_REVISION` was
 *     produced by a newer build — opening it here could misread fields, so it is
 *     blocked with a "update the app" reason.
 * User data carries no data revision, so it is never gated here — its migrations
 * bring it current.
 */
export function evaluateBackupImport(manifest: BackupManifest): BackupImportDecision {
  const warnings: string[] = [];
  const game = manifest.databases.game;
  if (game) {
    if (game.dataRevision < MINIMUM_SUPPORTED_DATA_REVISION) {
      return {
        blocked: true,
        kind: 'data-too-old',
        reason:
          `This game data (revision ${game.dataRevision}) is older than this ` +
          `version of the app can read (it needs at least revision ${MINIMUM_SUPPORTED_DATA_REVISION}).`,
        warnings,
      };
    }
    if (game.schemaVersion > LATEST_SCHEMA_VERSION) {
      return {
        blocked: true,
        kind: 'app-too-old',
        reason:
          `This game data uses a newer database format (schema ${game.schemaVersion}) than this ` +
          `version of the app supports (up to ${LATEST_SCHEMA_VERSION}). Update the app to use it.`,
        warnings,
      };
    }
    if (game.dataRevision > CURRENT_DATA_REVISION) {
      return {
        blocked: true,
        kind: 'app-too-old',
        reason:
          `This game data (revision ${game.dataRevision}) was produced by a newer version of the ` +
          `app than this one (which supports up to revision ${CURRENT_DATA_REVISION}). Update the app to use it.`,
        warnings,
      };
    }
    if (game.dataRevision < CURRENT_DATA_REVISION) {
      warnings.push(
        `This game data (revision ${game.dataRevision}) predates this version ` +
          `(revision ${CURRENT_DATA_REVISION}). It will import, but re-running setup unlocks newer fields.`,
      );
    }
  }
  return { blocked: false, warnings };
}
