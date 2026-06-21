import { describe, expect, it, vi } from 'vitest';
import type { DatasetManifest } from '@scrolled/dataset-core';
import type { DatasetRepository } from '@scrolled/dataset-repository';
import { installDataset, type InstallPhase } from './index';

const MANIFEST: DatasetManifest = {
  id: 'mapleroyals-2026-06-01',
  family: 'mapleroyals',
  version: '2026-06-01',
  displayName: 'MapleRoyals',
  serverProfileId: 'mapleroyals',
  calculatorId: 'mapleroyals-v1',
  dataRevision: 17,
  schemaVersion: 34,
  artifact: { url: 'x.scrolled-dataset', sizeBytes: 3 },
};

const BYTES = new Uint8Array([7, 8, 9]);

function fakeRepository(overrides: Partial<DatasetRepository> = {}): DatasetRepository {
  return {
    resolveChannel: async () => MANIFEST,
    downloadArtifact: async () => BYTES,
    ...overrides,
  };
}

describe('installDataset', () => {
  it('resolves, validates, downloads, and hands the bytes to the sink', async () => {
    const install = vi.fn(async () => {});
    const phases: InstallPhase[] = [];

    const manifest = await installDataset({
      repository: fakeRepository(),
      ref: { family: 'mapleroyals', channel: 'latest' },
      sink: { install },
      onProgress: (p) => phases.push(p.phase),
    });

    expect(manifest).toEqual(MANIFEST);
    expect(install).toHaveBeenCalledWith(BYTES);
    expect(phases).toEqual(['resolving', 'downloading', 'installing', 'done']);
  });

  it('runs onManifest before downloading and aborts the install if it throws', async () => {
    const downloadArtifact = vi.fn(async () => BYTES);
    const install = vi.fn(async () => {});

    await expect(
      installDataset({
        repository: fakeRepository({ downloadArtifact }),
        ref: { family: 'mapleroyals', channel: 'latest' },
        sink: { install },
        onManifest: () => {
          throw new Error('unsupported');
        },
      }),
    ).rejects.toThrow('unsupported');

    expect(downloadArtifact).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
  });

  it('surfaces a repository resolve failure', async () => {
    await expect(
      installDataset({
        repository: fakeRepository({
          resolveChannel: async () => {
            throw new Error('not found');
          },
        }),
        ref: { family: 'mapleroyals', channel: 'latest' },
        sink: { install: async () => {} },
      }),
    ).rejects.toThrow('not found');
  });
});
