// The `.scrolled-backup` container: a gzip-compressed tar bundling a manifest
// and the raw bytes of the game and/or user SQLite databases.
//
// Layout (manifest first, so a reader can inspect metadata before unpacking the
// large database blobs):
//
//   manifest.json   — see ./manifest.ts
//   game.sqlite3    — optional, raw game database
//   user.sqlite3    — optional, raw user database
//
// Operates only on byte buffers — no React, no SQLite, no parser/extractor
// imports — so it sits cleanly in the db layer below the worker boundary.

import { gzip, gunzip } from 'fflate';
import { packTar, unpackTar } from '@/lib/tar';
import { MINIMUM_SUPPORTED_DATA_REVISION } from '@/db/dataVersion';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  backupManifestSchema,
  type BackupManifest,
} from './manifest';

const MANIFEST_NAME = 'manifest.json';
const GAME_FILE = 'game.sqlite3';
const USER_FILE = 'user.sqlite3';

export interface BackupVersions {
  game?: { schemaVersion: number; dataRevision: number };
  user?: { schemaVersion: number };
}

export interface BackupParts {
  game?: Uint8Array;
  user?: Uint8Array;
  versions: BackupVersions;
  app?: { version?: string; commit?: string };
}

export interface BackupContents {
  manifest: BackupManifest;
  game?: Uint8Array;
  user?: Uint8Array;
}

/** True when the bytes start with the gzip magic — i.e. look like our container. */
export function looksLikeBackup(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  let hex = '';
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// fflate's async helpers offload to their own worker, so a multi-hundred-MB
// game database doesn't freeze the UI thread while it (de)compresses.
function gzipAsync(bytes: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    gzip(bytes, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data))),
  );
}
function gunzipAsync(bytes: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    gunzip(bytes, (err, data) => (err ? reject(err) : resolve(data))),
  );
}

export async function packBackup(parts: BackupParts): Promise<Uint8Array> {
  if (!parts.game && !parts.user) {
    throw new Error('Nothing to back up — select at least one database.');
  }

  const databases: BackupManifest['databases'] = {};
  const entries: { name: string; bytes: Uint8Array }[] = [];

  if (parts.game) {
    if (!parts.versions.game) throw new Error('Missing game version metadata.');
    databases.game = {
      file: GAME_FILE,
      byteLength: parts.game.byteLength,
      sha256: await sha256Hex(parts.game),
      schemaVersion: parts.versions.game.schemaVersion,
      dataRevision: parts.versions.game.dataRevision,
      minimumSupportedDataRevision: MINIMUM_SUPPORTED_DATA_REVISION,
    };
  }
  if (parts.user) {
    if (!parts.versions.user) throw new Error('Missing user version metadata.');
    databases.user = {
      file: USER_FILE,
      byteLength: parts.user.byteLength,
      sha256: await sha256Hex(parts.user),
      schemaVersion: parts.versions.user.schemaVersion,
    };
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    app: parts.app,
    databases,
  };

  entries.push({
    name: MANIFEST_NAME,
    bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
  });
  if (parts.game) entries.push({ name: GAME_FILE, bytes: parts.game });
  if (parts.user) entries.push({ name: USER_FILE, bytes: parts.user });

  return gzipAsync(packTar(entries));
}

export async function readBackup(bytes: Uint8Array): Promise<BackupContents> {
  const entries = unpackTar(await gunzipAsync(bytes));

  const manifestEntry = entries.find((e) => e.name === MANIFEST_NAME);
  if (!manifestEntry) throw new Error('Not a Scrolled backup — its manifest is missing.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(manifestEntry.bytes));
  } catch {
    throw new Error('Backup manifest is not valid JSON.');
  }
  const manifest = backupManifestSchema.parse(parsed);
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `This backup uses a newer format (v${manifest.formatVersion}) than this version ` +
        `supports (v${BACKUP_FORMAT_VERSION}). Update the app to import it.`,
    );
  }

  const result: BackupContents = { manifest };
  const declared = [
    ['game', manifest.databases.game],
    ['user', manifest.databases.user],
  ] as const;
  for (const [key, entry] of declared) {
    if (!entry) continue;
    const blob = entries.find((e) => e.name === entry.file);
    if (!blob) throw new Error(`Backup is missing ${entry.file}.`);
    if (blob.bytes.byteLength !== entry.byteLength) {
      throw new Error(`Backup ${entry.file} is corrupt (size mismatch).`);
    }
    if ((await sha256Hex(blob.bytes)) !== entry.sha256) {
      throw new Error(`Backup ${entry.file} is corrupt (checksum mismatch).`);
    }
    result[key] = blob.bytes;
  }
  return result;
}
