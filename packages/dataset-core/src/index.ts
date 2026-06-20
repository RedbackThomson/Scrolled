// Shared dataset types and schemas used by the builder (writes them), the
// repository (validates them on fetch), and the client (consumes them).
//
// URLs in manifests and channel docs are relative to the repository base URL
// (the repository resolves them). Absolute URLs are passed through unchanged,
// which lets a published dataset point at a CDN if it wants to.

import { z } from 'zod';

/** A downloadable dataset artifact (today: a `.scrolled-backup` container). */
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
  /** Extracted-data revision the artifact was built at (informational). */
  dataRevision: z.number().int().optional(),
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
