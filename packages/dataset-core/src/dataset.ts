// The `.scrolled-dataset` container: a gzip-compressed tar carrying a published
// game database for the hosted deployment mode. Distinct from the
// `.scrolled-backup` (a user's own game + user db export, owned by
// @scrolled/game-db): a dataset is download-only, game-data-only, and is
// described by an external repository manifest (see ./index.ts). They share the
// tar/gzip codec (./container.ts) but have separate schemas and owners.
//
// Layout (manifest first, so a reader can inspect metadata before unpacking the
// large database blob):
//
//   manifest.json   — the container manifest below
//   game.sqlite3    — raw game database bytes

import { z } from 'zod';
import {
  gzipAsync,
  gunzipAsync,
  looksLikeGzip,
  packTar,
  sha256Hex,
  unpackTar,
} from './container';

export const DATASET_FORMAT = 'scrolled-dataset';
export const DATASET_FORMAT_VERSION = 1;

const GAME_FILE = 'game.sqlite3';
const MANIFEST_NAME = 'manifest.json';

/** Self-describing manifest carried inside the container, beside the bytes. */
export const datasetContainerManifestSchema = z.object({
  format: z.literal(DATASET_FORMAT),
  formatVersion: z.number().int().positive(),
  createdAt: z.string(),
  /** Best-effort build provenance; absent in forks/dev where it isn't injected. */
  app: z.object({ version: z.string().optional(), commit: z.string().optional() }).optional(),
  game: z.object({
    file: z.string(),
    byteLength: z.number().int().nonnegative(),
    /** Lowercase SHA-256 hex of the blob, verified on read. */
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    /** SQLite schema version the blob was built at. */
    schemaVersion: z.number().int().nonnegative(),
    /** Extracted-data contract the blob was produced under. */
    dataRevision: z.number().int().nonnegative(),
  }),
});
export type DatasetContainerManifest = z.infer<typeof datasetContainerManifestSchema>;

export interface PackDatasetParts {
  game: Uint8Array;
  schemaVersion: number;
  dataRevision: number;
  createdAt: string;
  app?: { version?: string; commit?: string };
}

export interface DatasetContents {
  manifest: DatasetContainerManifest;
  game: Uint8Array;
}

/** True when the bytes look like our gzip container. The format literal inside
 * the manifest is what actually distinguishes a dataset from a backup. */
export function looksLikeDataset(bytes: Uint8Array): boolean {
  return looksLikeGzip(bytes);
}

export async function packDataset(parts: PackDatasetParts): Promise<Uint8Array> {
  const manifest: DatasetContainerManifest = {
    format: DATASET_FORMAT,
    formatVersion: DATASET_FORMAT_VERSION,
    createdAt: parts.createdAt,
    app: parts.app,
    game: {
      file: GAME_FILE,
      byteLength: parts.game.byteLength,
      sha256: await sha256Hex(parts.game),
      schemaVersion: parts.schemaVersion,
      dataRevision: parts.dataRevision,
    },
  };

  return gzipAsync(
    packTar([
      { name: MANIFEST_NAME, bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
      { name: GAME_FILE, bytes: parts.game },
    ]),
  );
}

export async function readDataset(bytes: Uint8Array): Promise<DatasetContents> {
  const entries = unpackTar(await gunzipAsync(bytes));

  const manifestEntry = entries.find((e) => e.name === MANIFEST_NAME);
  if (!manifestEntry) throw new Error('Not a Scrolled dataset — its manifest is missing.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(manifestEntry.bytes));
  } catch {
    throw new Error('Dataset manifest is not valid JSON.');
  }
  const manifest = datasetContainerManifestSchema.parse(parsed);
  if (manifest.formatVersion > DATASET_FORMAT_VERSION) {
    throw new Error(
      `This dataset uses a newer format (v${manifest.formatVersion}) than this version ` +
        `supports (v${DATASET_FORMAT_VERSION}). Update the app to install it.`,
    );
  }

  const blob = entries.find((e) => e.name === manifest.game.file);
  if (!blob) throw new Error(`Dataset is missing ${manifest.game.file}.`);
  if (blob.bytes.byteLength !== manifest.game.byteLength) {
    throw new Error(`Dataset ${manifest.game.file} is corrupt (size mismatch).`);
  }
  if ((await sha256Hex(blob.bytes)) !== manifest.game.sha256) {
    throw new Error(`Dataset ${manifest.game.file} is corrupt (checksum mismatch).`);
  }
  return { manifest, game: blob.bytes };
}
