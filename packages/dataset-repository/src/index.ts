// Static-HTTP dataset repository: resolves a channel to a concrete manifest and
// downloads + integrity-checks the artifact. No DB or OPFS knowledge — it deals
// only in bytes, so it runs anywhere `fetch` and Web Crypto are available.

import {
  datasetChannelSchema,
  datasetManifestSchema,
  type DatasetManifest,
  type DatasetRef,
} from '@scrolled/dataset-core';

export interface DownloadProgress {
  receivedBytes: number;
  /** Null when the server didn't advertise a length and the manifest had no size. */
  totalBytes: number | null;
}

export interface DatasetRepository {
  resolveChannel(ref: DatasetRef): Promise<DatasetManifest>;
  downloadArtifact(
    manifest: DatasetManifest,
    onProgress?: (p: DownloadProgress) => void,
  ): Promise<Uint8Array>;
}

/** What went wrong, so the UI can choose copy and whether to offer retry. */
export type DatasetErrorKind = 'not-found' | 'network' | 'checksum' | 'malformed';

export class DatasetRepositoryError extends Error {
  constructor(
    readonly kind: DatasetErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DatasetRepositoryError';
  }
}

export class StaticHttpDatasetRepository implements DatasetRepository {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /** Resolve a URL that may be repository-relative or already absolute. */
  private resolveUrl(url: string): string {
    if (/^https?:\/\//.test(url) || url.startsWith('/')) return url;
    return `${this.baseUrl}/${url.replace(/^\/+/, '')}`;
  }

  async resolveChannel(ref: DatasetRef): Promise<DatasetManifest> {
    const channelUrl = this.resolveUrl(`${ref.family}/${ref.channel}.json`);
    const channel = datasetChannelSchema.parse(await this.fetchJson(channelUrl));
    const manifest = datasetManifestSchema.parse(
      await this.fetchJson(this.resolveUrl(channel.manifestUrl)),
    );
    return manifest;
  }

  async downloadArtifact(
    manifest: DatasetManifest,
    onProgress?: (p: DownloadProgress) => void,
  ): Promise<Uint8Array> {
    const url = this.resolveUrl(manifest.artifact.url);
    const bytes = await this.fetchBytes(url, manifest.artifact.sizeBytes ?? null, onProgress);

    if (manifest.artifact.sha256) {
      const actual = await sha256Hex(bytes);
      if (actual.toLowerCase() !== manifest.artifact.sha256.toLowerCase()) {
        throw new DatasetRepositoryError(
          'checksum',
          'Downloaded dataset failed its integrity check.',
        );
      }
    }
    return bytes;
  }

  private async fetchJson(url: string): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(url, { cache: 'no-cache' });
    } catch (cause) {
      throw new DatasetRepositoryError('network', `Could not reach ${url}.`, cause);
    }
    if (res.status === 404) {
      throw new DatasetRepositoryError('not-found', `Dataset metadata not found at ${url}.`);
    }
    if (!res.ok) {
      throw new DatasetRepositoryError('network', `Request to ${url} failed (${res.status}).`);
    }
    try {
      return await res.json();
    } catch (cause) {
      throw new DatasetRepositoryError('malformed', `Dataset metadata at ${url} is not valid JSON.`, cause);
    }
  }

  private async fetchBytes(
    url: string,
    manifestSize: number | null,
    onProgress?: (p: DownloadProgress) => void,
  ): Promise<Uint8Array> {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (cause) {
      throw new DatasetRepositoryError('network', `Could not download ${url}.`, cause);
    }
    if (res.status === 404) {
      throw new DatasetRepositoryError('not-found', `Dataset artifact not found at ${url}.`);
    }
    if (!res.ok || !res.body) {
      throw new DatasetRepositoryError('network', `Download of ${url} failed (${res.status}).`);
    }

    const headerLen = Number(res.headers.get('content-length'));
    const totalBytes = Number.isFinite(headerLen) && headerLen > 0 ? headerLen : manifestSize;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    onProgress?.({ receivedBytes: 0, totalBytes });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        onProgress?.({ receivedBytes: received, totalBytes });
      }
    }

    const out = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Cast: the DOM lib types digest's input as `BufferSource` backed by a plain
  // ArrayBuffer, but a Uint8Array is generically `ArrayBufferLike`.
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
