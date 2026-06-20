// Shared dataset types and schemas used by the builder (writes them), the
// repository (validates them on fetch), and the client (consumes them).
//
// URLs in manifests and channel docs are relative to the repository base URL
// (the repository resolves them). Absolute URLs are passed through unchanged,
// which lets a published dataset point at a CDN if it wants to.

import { z } from 'zod';

/** A downloadable dataset artifact (a `.scrolled-dataset` container; see ./dataset.ts). */
export const datasetArtifactSchema = z.object({
  /** URL relative to the repository base, or an absolute http(s) URL. */
  url: z.string().min(1),
  contentType: z.string().optional(),
  /** Lowercase hex SHA-256 of the artifact bytes. Verified on download when present. */
  sha256: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type DatasetArtifact = z.infer<typeof datasetArtifactSchema>;

/** Immutable description of one published dataset version. */
export const datasetManifestSchema = z.object({
  /** Globally unique id, conventionally `${family}-${version}`. */
  id: z.string().min(1),
  family: z.string().min(1),
  version: z.string().min(1),
  /** Human-facing name shown in install UI. Lives in data, never in app source. */
  displayName: z.string().min(1),
  /**
   * Server profile the dataset requires (EXP rate, stat-range calculator, …).
   * The app pins this on install so a fixed dataset always renders under the
   * right rules; the app build must ship a profile with this id.
   */
  serverProfileId: z.string().min(1),
  /**
   * The profile's equip-stat *calculator* id. Unlike the profile config (which
   * now travels in the bundle), the calculator is code keyed by id — a brand-new
   * algorithm needs an app release. The app checks this against its registry to
   * decide, pre-download, whether it can render the dataset.
   */
  calculatorId: z.string().min(1),
  /** Extracted-data revision the artifact was built at. Gates compatibility. */
  dataRevision: z.number().int().nonnegative(),
  /** SQLite schema version the artifact was built at. Gates compatibility. */
  schemaVersion: z.number().int().nonnegative(),
  buildTimestamp: z.string().optional(),
  artifact: datasetArtifactSchema,
});
export type DatasetManifest = z.infer<typeof datasetManifestSchema>;

/** A channel (e.g. "latest") resolving to a concrete immutable version. */
export const datasetChannelSchema = z.object({
  family: z.string().min(1),
  channel: z.string().min(1),
  version: z.string().min(1),
  /** URL of the resolved version's manifest, relative to the repository base. */
  manifestUrl: z.string().min(1),
});
export type DatasetChannel = z.infer<typeof datasetChannelSchema>;

/** What the app asks the repository to resolve: a family + channel. */
export interface DatasetRef {
  family: string;
  channel: string;
}

// The .scrolled-dataset container format + the shared tar/gzip codec.
export {
  DATASET_FORMAT,
  DATASET_FORMAT_VERSION,
  datasetContainerManifestSchema,
  looksLikeDataset,
  packDataset,
  readDataset,
  type DatasetContainerManifest,
  type PackDatasetParts,
  type DatasetContents,
} from './dataset';
export {
  packTar,
  unpackTar,
  looksLikeGzip,
  gzipAsync,
  gunzipAsync,
  sha256Hex,
  type TarEntry,
} from './container';
