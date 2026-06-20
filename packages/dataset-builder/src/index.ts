// Package an exported library backup into a static dataset repository layout:
//
//   <out>/<family>/<channel>.json            (channel -> concrete version)
//   <out>/<family>/<version>/manifest.json
//   <out>/<family>/<version>/checksums.json
//   <out>/<family>/<version>/<artifact>      (copy of the backup)
//
// The input is whatever the generic site's "Export backup" produced (a
// `.scrolled-backup` container). Everything is parameterized so this runs
// against data living in another repository.

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  datasetChannelSchema,
  datasetManifestSchema,
  type DatasetChannel,
  type DatasetManifest,
} from '@scrolled/dataset-core';

export interface BuildDatasetOptions {
  /** Path to the exported `.scrolled-backup` (or other artifact) file. */
  input: string;
  /** Repository root directory to write into. */
  out: string;
  family: string;
  version: string;
  displayName: string;
  /** Channel to (re)point at this version. Defaults to "latest". */
  channel?: string;
  /** Dataset id. Defaults to `${family}-${version}`. */
  id?: string;
  dataRevision?: number;
  buildTimestamp?: string;
}

export interface BuildDatasetResult {
  manifest: DatasetManifest;
  channel: DatasetChannel;
  versionDir: string;
  channelPath: string;
}

export async function buildDataset(opts: BuildDatasetOptions): Promise<BuildDatasetResult> {
  const channelName = opts.channel ?? 'latest';
  const id = opts.id ?? `${opts.family}-${opts.version}`;

  const bytes = await readFile(opts.input);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const sizeBytes = bytes.byteLength;
  const artifactName = basename(opts.input);

  const versionDir = join(opts.out, opts.family, opts.version);
  await mkdir(versionDir, { recursive: true });
  await copyFile(opts.input, join(versionDir, artifactName));

  const manifest = datasetManifestSchema.parse({
    id,
    family: opts.family,
    version: opts.version,
    displayName: opts.displayName,
    dataRevision: opts.dataRevision,
    buildTimestamp: opts.buildTimestamp,
    artifact: {
      url: `${opts.family}/${opts.version}/${artifactName}`,
      contentType: 'application/gzip',
      sha256,
      sizeBytes,
    },
  } satisfies DatasetManifest);
  await writeFile(join(versionDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  await writeFile(
    join(versionDir, 'checksums.json'),
    `${JSON.stringify({ [artifactName]: { sha256, sizeBytes } }, null, 2)}\n`,
  );

  const channel = datasetChannelSchema.parse({
    family: opts.family,
    channel: channelName,
    version: opts.version,
    manifestUrl: `${opts.family}/${opts.version}/manifest.json`,
  } satisfies DatasetChannel);
  const channelPath = join(opts.out, opts.family, `${channelName}.json`);
  await writeFile(channelPath, `${JSON.stringify(channel, null, 2)}\n`);

  return { manifest, channel, versionDir, channelPath };
}
