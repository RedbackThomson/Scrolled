// Bundle packaging + static repository layout for built datasets.
//
//   <out>/<family>/<channel>.json              (channel -> concrete version)
//   <out>/<family>/<version>/manifest.json     (generated dataset manifest)
//   <out>/<family>/<version>/<artifact>        (the .scrolled-dataset bundle)
//   <out>/<family>/<version>/checksums.json
//
// The `.scrolled-dataset` bundle is the existing tar+gzip container (see
// db/backup/format.ts) carrying the game SQLite + the inline server profile.
// The host-side manifest.json is *generated from* the bundle so its
// compatibility fields can't drift from what the artifact actually contains.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  datasetChannelSchema,
  datasetManifestSchema,
  type DatasetChannel,
  type DatasetManifest,
} from '@scrolled/dataset-core';

export interface WriteDatasetRepoOptions {
  /** Repository root to write into. */
  out: string;
  family: string;
  version: string;
  displayName: string;
  /** Server profile id (pinned on install). */
  serverProfileId: string;
  /** The profile's equip-stat calculator id (checked against the app registry). */
  calculatorId: string;
  /** Extracted-data revision the bundle was built at. */
  dataRevision: number;
  /** SQLite schema version the bundle was built at. */
  schemaVersion: number;
  /** Channel to (re)point at this version. Defaults to 'latest'. */
  channel?: string;
  buildTimestamp?: string;
  /** The packed `.scrolled-dataset` bytes. */
  bundle: Uint8Array;
}

export interface WriteDatasetRepoResult {
  manifest: DatasetManifest;
  channel: DatasetChannel;
  versionDir: string;
  artifactPath: string;
  channelPath: string;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256')
    .update(bytes as Uint8Array<ArrayBuffer>)
    .digest('hex');
}

export function writeDatasetRepo(opts: WriteDatasetRepoOptions): WriteDatasetRepoResult {
  const channelName = opts.channel ?? 'latest';
  const id = `${opts.family}-${opts.version}`;
  const artifactName = `${id}.scrolled-dataset`;
  const sha256 = sha256Hex(opts.bundle);
  const sizeBytes = opts.bundle.byteLength;

  const versionDir = resolve(opts.out, opts.family, opts.version);
  mkdirSync(versionDir, { recursive: true });

  const artifactPath = resolve(versionDir, artifactName);
  writeFileSync(artifactPath, opts.bundle);

  const manifest = datasetManifestSchema.parse({
    id,
    family: opts.family,
    version: opts.version,
    displayName: opts.displayName,
    serverProfileId: opts.serverProfileId,
    calculatorId: opts.calculatorId,
    dataRevision: opts.dataRevision,
    schemaVersion: opts.schemaVersion,
    buildTimestamp: opts.buildTimestamp,
    artifact: {
      url: `${opts.family}/${opts.version}/${artifactName}`,
      contentType: 'application/gzip',
      sha256,
      sizeBytes,
    },
  } satisfies DatasetManifest);
  writeFileSync(resolve(versionDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  writeFileSync(
    resolve(versionDir, 'checksums.json'),
    `${JSON.stringify({ [artifactName]: { sha256, sizeBytes } }, null, 2)}\n`,
  );

  const channel = datasetChannelSchema.parse({
    family: opts.family,
    channel: channelName,
    version: opts.version,
    manifestUrl: `${opts.family}/${opts.version}/manifest.json`,
  } satisfies DatasetChannel);
  const channelPath = resolve(opts.out, opts.family, `${channelName}.json`);
  writeFileSync(channelPath, `${JSON.stringify(channel, null, 2)}\n`);

  return { manifest, channel, versionDir, artifactPath, channelPath };
}
