// Orchestrates installing a hosted dataset. Resolves the concrete manifest via
// a repository, downloads the artifact, and hands the bytes to an injected
// sink. The sink is where storage lives (in the app: write to OPFS via the DB
// worker), so this stays free of any DB/OPFS dependency and is unit-testable.

import type { DatasetManifest, DatasetRef } from '@scrolled/dataset-core';
import type { DatasetRepository, DownloadProgress } from '@scrolled/dataset-repository';

/** Receives the downloaded artifact bytes and persists them. */
export interface DatasetSink {
  install(bytes: Uint8Array): Promise<void>;
}

export type InstallPhase = 'resolving' | 'downloading' | 'installing' | 'done';

export interface InstallProgress {
  phase: InstallPhase;
  /** Available once the channel has resolved. */
  manifest?: DatasetManifest;
  /** Present while downloading. */
  download?: DownloadProgress;
}

export interface InstallDatasetOptions {
  repository: DatasetRepository;
  ref: DatasetRef;
  sink: DatasetSink;
  onProgress?: (p: InstallProgress) => void;
  /**
   * Validate the resolved manifest before the (large) download — throw to abort.
   * Used to fail fast when the app can't support the dataset (e.g. it requires a
   * server profile this build doesn't ship).
   */
  onManifest?: (manifest: DatasetManifest) => void | Promise<void>;
}

/** Resolve → validate → download → install. Returns the resolved manifest. */
export async function installDataset(opts: InstallDatasetOptions): Promise<DatasetManifest> {
  const { repository, ref, sink, onProgress, onManifest } = opts;

  onProgress?.({ phase: 'resolving' });
  const manifest = await repository.resolveChannel(ref);
  if (onManifest) await onManifest(manifest);

  onProgress?.({
    phase: 'downloading',
    manifest,
    download: { receivedBytes: 0, totalBytes: manifest.artifact.sizeBytes ?? null },
  });
  const bytes = await repository.downloadArtifact(manifest, (download) =>
    onProgress?.({ phase: 'downloading', manifest, download }),
  );

  onProgress?.({ phase: 'installing', manifest });
  await sink.install(bytes);

  onProgress?.({ phase: 'done', manifest });
  return manifest;
}
