// Export/import the whole library as a single `.scrolled-backup` file.
//
// Unlike the per-DB raw dumps these replace, the container carries a manifest
// (db/backup) so an import can be vetted against this build's data revision
// before the live databases are touched.

import { useMemo } from 'react';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { getDbClient } from '@/db';
import { getUserDbClient } from '@/db/user';
import {
  classifyRawSqlite,
  evaluateBackupImport,
  looksLikeBackup,
  looksLikeRawSqlite,
  packBackup,
  readBackup,
  type BackupParts,
} from '@/db/backup';
import { downloadBytes, todayStamp } from '@/components/collections';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('backup');

/** Which databases an export should include. */
export type BackupScope = 'all' | 'game' | 'user';

export interface ExportBackupResult {
  filename: string;
  byteLength: number;
}

export interface ImportBackupResult {
  imported: ('game' | 'user')[];
  warnings: string[];
  /** True when restored from a pre-format raw `.sqlite3` dump. */
  legacy: boolean;
  /** Backend + schema of the last database imported, for status display. */
  backend: 'opfs' | 'memory' | null;
  schemaVersion: number | null;
}

/**
 * Restore a backup file's bytes into the live databases. Accepts the
 * `.scrolled-backup` container (manifest-gated against this build's data
 * revision before anything is touched) and, for now, bare `.sqlite3` dumps.
 * Shared by the Settings importer and the setup-wizard restore so both honor
 * the same format, gate, and legacy fallback. Does not invalidate query caches
 * — callers do that.
 */
export async function importBackupBytes(bytes: Uint8Array): Promise<ImportBackupResult> {
  const db = getDbClient();
  const userDb = getUserDbClient();

  if (looksLikeBackup(bytes)) {
    const contents = await readBackup(bytes);
    const decision = evaluateBackupImport(contents.manifest);
    if (decision.blocked) throw new Error(decision.reason);
    const imported: ('game' | 'user')[] = [];
    let backend: 'opfs' | 'memory' | null = null;
    let schemaVersion: number | null = null;
    // Migrations run inside each importBytes, bringing an older-but-readable
    // schema up to current.
    if (contents.game) {
      const r = await db.importBytes(contents.game);
      imported.push('game');
      backend = r.backend;
      schemaVersion = r.schemaVersion;
    }
    if (contents.user) {
      const r = await userDb.importBytes(contents.user);
      imported.push('user');
      backend ??= r.backend;
      schemaVersion ??= r.schemaVersion;
    }
    return { imported, warnings: decision.warnings, legacy: false, backend, schemaVersion };
  }

  // Legacy path — removable at GA, see db/backup/legacy.ts.
  if (looksLikeRawSqlite(bytes)) {
    const target = classifyRawSqlite(bytes);
    if (target === 'user') {
      const r = await userDb.importBytes(bytes);
      return {
        imported: ['user'],
        warnings: [],
        legacy: true,
        backend: r.backend,
        schemaVersion: r.schemaVersion,
      };
    }
    if (target === 'game') {
      const r = await db.importBytes(bytes);
      return {
        imported: ['game'],
        warnings: [],
        legacy: true,
        backend: r.backend,
        schemaVersion: r.schemaVersion,
      };
    }
    throw new Error("Couldn't tell whether this SQLite file is game data or collections.");
  }

  throw new Error('Unrecognized file. Choose a .scrolled-backup file.');
}

function appMeta(): { version?: string; commit?: string } | undefined {
  const version = import.meta.env.VITE_APP_VERSION as string | undefined;
  const commit = import.meta.env.VITE_APP_COMMIT as string | undefined;
  if (!version && !commit) return undefined;
  return { version, commit };
}

function exportFilename(scope: BackupScope): string {
  const stamp = todayStamp();
  if (scope === 'game') return `scrolled-game-${stamp}.scrolled-backup`;
  if (scope === 'user') return `scrolled-collections-${stamp}.scrolled-backup`;
  return `scrolled-${stamp}.scrolled-backup`;
}

export function useExportBackup(): UseMutationResult<ExportBackupResult, Error, BackupScope> {
  const db = useMemo(() => getDbClient(), []);
  const userDb = useMemo(() => getUserDbClient(), []);
  return useMutation({
    mutationFn: async (scope: BackupScope) => {
      const parts: BackupParts = { versions: {}, app: appMeta() };
      if (scope === 'all' || scope === 'game') {
        const [bytes, status] = await Promise.all([db.exportBytes(), db.status()]);
        parts.game = bytes;
        parts.versions.game = {
          schemaVersion: status.schemaVersion,
          dataRevision: status.dataRevision,
        };
      }
      if (scope === 'all' || scope === 'user') {
        const [bytes, status] = await Promise.all([userDb.exportBytes(), userDb.status()]);
        parts.user = bytes;
        parts.versions.user = { schemaVersion: status.schemaVersion };
      }
      const archive = await packBackup(parts);
      const filename = exportFilename(scope);
      downloadBytes(filename, archive, 'application/gzip');
      return { filename, byteLength: archive.byteLength };
    },
    onError: (e) => log.error('export failed', describeError(e)),
  });
}

export function useImportBackup(): UseMutationResult<ImportBackupResult, Error, File> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => importBackupBytes(new Uint8Array(await file.arrayBuffer())),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['db'] });
      qc.invalidateQueries({ queryKey: ['user', 'collections'] });
      log.info('import complete', result);
    },
    onError: (e) => log.error('import failed', describeError(e)),
  });
}
