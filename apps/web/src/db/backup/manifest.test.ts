import { describe, expect, it } from 'vitest';
import { CURRENT_DATA_REVISION, MINIMUM_SUPPORTED_DATA_REVISION } from '@/db/dataVersion';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  backupManifestSchema,
  evaluateBackupImport,
  type BackupManifest,
} from './manifest';

const HASH = 'a'.repeat(64);

function manifest(over: Partial<BackupManifest['databases']>): BackupManifest {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    databases: over,
  };
}

function game(dataRevision: number) {
  return {
    file: 'game.sqlite3',
    byteLength: 10,
    sha256: HASH,
    schemaVersion: 17,
    dataRevision,
    minimumSupportedDataRevision: MINIMUM_SUPPORTED_DATA_REVISION,
  };
}

describe('evaluateBackupImport', () => {
  it('blocks game data below the minimum supported revision', () => {
    const d = evaluateBackupImport(manifest({ game: game(MINIMUM_SUPPORTED_DATA_REVISION - 1) }));
    expect(d.blocked).toBe(true);
    expect(d.reason).toMatch(/older than this version can read/);
  });

  it('warns but allows game data between minimum and current', () => {
    // Only meaningful when the window is non-empty; otherwise assert the
    // current-revision case stays clean.
    if (CURRENT_DATA_REVISION > MINIMUM_SUPPORTED_DATA_REVISION) {
      const d = evaluateBackupImport(manifest({ game: game(MINIMUM_SUPPORTED_DATA_REVISION) }));
      expect(d.blocked).toBe(false);
      expect(d.warnings).toHaveLength(1);
    }
  });

  it('passes cleanly at the current revision', () => {
    const d = evaluateBackupImport(manifest({ game: game(CURRENT_DATA_REVISION) }));
    expect(d.blocked).toBe(false);
    expect(d.warnings).toHaveLength(0);
  });

  it('never gates a user-only backup', () => {
    const d = evaluateBackupImport(
      manifest({ user: { file: 'user.sqlite3', byteLength: 5, sha256: HASH, schemaVersion: 2 } }),
    );
    expect(d.blocked).toBe(false);
    expect(d.warnings).toHaveLength(0);
  });
});

describe('backupManifestSchema', () => {
  it('rejects a wrong format tag', () => {
    expect(() =>
      backupManifestSchema.parse({
        ...manifest({ game: game(CURRENT_DATA_REVISION) }),
        format: 'nope',
      }),
    ).toThrow();
  });

  it('rejects a malformed sha256', () => {
    expect(() =>
      backupManifestSchema.parse(
        manifest({
          user: { file: 'user.sqlite3', byteLength: 5, sha256: 'short', schemaVersion: 2 },
        }),
      ),
    ).toThrow();
  });
});
