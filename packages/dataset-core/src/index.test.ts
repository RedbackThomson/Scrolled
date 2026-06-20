import { describe, expect, it } from 'vitest';
import { datasetChannelSchema, datasetManifestSchema } from './index';

describe('datasetManifestSchema', () => {
  it('accepts a minimal manifest and drops absent optionals', () => {
    const manifest = datasetManifestSchema.parse({
      id: 'local-2026-06-20',
      family: 'local',
      version: '2026-06-20',
      displayName: 'Local Dataset',
      serverProfileId: 'vanilla-v83',
      artifact: { url: 'local/2026-06-20/game.scrolled-backup' },
    });
    expect(manifest.dataRevision).toBeUndefined();
    expect(manifest.artifact.sha256).toBeUndefined();
  });

  it('rejects a manifest missing the artifact', () => {
    expect(() =>
      datasetManifestSchema.parse({
        id: 'x',
        family: 'local',
        version: '1',
        displayName: 'X',
        serverProfileId: 'vanilla-v83',
      }),
    ).toThrow();
  });

  it('rejects a manifest missing the server profile', () => {
    expect(() =>
      datasetManifestSchema.parse({
        id: 'x',
        family: 'local',
        version: '1',
        displayName: 'X',
        artifact: { url: 'local/1/game.scrolled-backup' },
      }),
    ).toThrow();
  });
});

describe('datasetChannelSchema', () => {
  it('requires a concrete version and manifest url', () => {
    const channel = datasetChannelSchema.parse({
      family: 'local',
      channel: 'latest',
      version: '2026-06-20',
      manifestUrl: 'local/2026-06-20/manifest.json',
    });
    expect(channel.version).toBe('2026-06-20');
  });
});
