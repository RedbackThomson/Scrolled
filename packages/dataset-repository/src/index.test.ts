import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatasetRepositoryError, StaticHttpDatasetRepository } from './index';

const BASE = 'https://data.example.test/repo';

const channel = {
  family: 'mapleroyals',
  channel: 'latest',
  version: '2026-06-01',
  manifestUrl: 'mapleroyals/2026-06-01/manifest.json',
};

function manifest(sha256?: string) {
  return {
    id: 'mapleroyals-2026-06-01',
    family: 'mapleroyals',
    version: '2026-06-01',
    displayName: 'MapleRoyals',
    serverProfileId: 'mapleroyals',
    calculatorId: 'mapleroyals-v1',
    dataRevision: 17,
    schemaVersion: 34,
    artifact: {
      url: 'mapleroyals/2026-06-01/mapleroyals-2026-06-01.scrolled-dataset',
      contentType: 'application/gzip',
      sha256,
      sizeBytes: 4,
    },
  };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('StaticHttpDatasetRepository.resolveChannel', () => {
  it('fetches the channel then its manifest, resolving relative URLs against the base', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      if (url.endsWith('latest.json')) return jsonResponse(channel);
      if (url.endsWith('manifest.json')) return jsonResponse(manifest());
      throw new Error(`unexpected url ${url}`);
    });

    const repo = new StaticHttpDatasetRepository(BASE);
    const m = await repo.resolveChannel({ family: 'mapleroyals', channel: 'latest' });

    expect(m.id).toBe('mapleroyals-2026-06-01');
    expect(urls[0]).toBe(`${BASE}/mapleroyals/latest.json`);
    expect(urls[1]).toBe(`${BASE}/mapleroyals/2026-06-01/manifest.json`);
  });

  it('maps a 404 to a not-found error', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
    const repo = new StaticHttpDatasetRepository(BASE);
    await expect(
      repo.resolveChannel({ family: 'mapleroyals', channel: 'latest' }),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('maps a thrown fetch to a network error', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const repo = new StaticHttpDatasetRepository(BASE);
    await expect(
      repo.resolveChannel({ family: 'mapleroyals', channel: 'latest' }),
    ).rejects.toMatchObject({ kind: 'network' });
  });

  it('rejects a malformed channel document', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ not: 'a channel' }));
    const repo = new StaticHttpDatasetRepository(BASE);
    await expect(
      repo.resolveChannel({ family: 'mapleroyals', channel: 'latest' }),
    ).rejects.toThrow();
  });
});

describe('StaticHttpDatasetRepository.downloadArtifact', () => {
  it('streams the bytes and passes a matching checksum', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const sha = await sha256Hex(bytes);
    vi.stubGlobal('fetch', async () => new Response(bytes));

    const repo = new StaticHttpDatasetRepository(BASE);
    const out = await repo.downloadArtifact(manifest(sha));
    expect(out).toEqual(bytes);
  });

  it('rejects a checksum mismatch', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    vi.stubGlobal('fetch', async () => new Response(bytes));

    const repo = new StaticHttpDatasetRepository(BASE);
    await expect(
      repo.downloadArtifact(manifest('0'.repeat(64))),
    ).rejects.toMatchObject({ kind: 'checksum' });
  });

  it('passes an absolute artifact URL through unchanged', async () => {
    const bytes = new Uint8Array([9]);
    let requested = '';
    vi.stubGlobal('fetch', async (url: string) => {
      requested = url;
      return new Response(bytes);
    });
    const repo = new StaticHttpDatasetRepository(BASE);
    const m = manifest();
    m.artifact.url = 'https://cdn.example.test/blob.scrolled-dataset';
    m.artifact.sha256 = undefined;
    await repo.downloadArtifact(m);
    expect(requested).toBe('https://cdn.example.test/blob.scrolled-dataset');
  });
});

it('exposes DatasetRepositoryError for callers to branch on', () => {
  const err = new DatasetRepositoryError('network', 'boom');
  expect(err).toBeInstanceOf(Error);
  expect(err.kind).toBe('network');
});
