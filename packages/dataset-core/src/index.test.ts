import { describe, expect, it } from 'vitest';
import { datasetChannelSchema, datasetManifestSchema } from './index';

describe('datasetManifestSchema', () => {
  const valid = {
    id: 'local-2026-06-20',
    family: 'local',
    version: '2026-06-20',
    displayName: 'Local Dataset',
    serverProfileId: 'vanilla-v83',
    calculatorId: 'mapleroyals-v83',
    dataRevision: 7,
    schemaVersion: 32,
    artifact: { url: 'local/2026-06-20/local-2026-06-20.scrolled-dataset' },
  };

  it('accepts a full manifest and drops absent artifact optionals', () => {
    const manifest = datasetManifestSchema.parse(valid);
    expect(manifest.dataRevision).toBe(7);
    expect(manifest.schemaVersion).toBe(32);
    expect(manifest.calculatorId).toBe('mapleroyals-v83');
    expect(manifest.artifact.sha256).toBeUndefined();
  });

  it('rejects a manifest missing the artifact', () => {
    const { artifact: _artifact, ...rest } = valid;
    expect(() => datasetManifestSchema.parse(rest)).toThrow();
  });

  it('rejects a manifest missing the server profile', () => {
    const { serverProfileId: _id, ...rest } = valid;
    expect(() => datasetManifestSchema.parse(rest)).toThrow();
  });

  it('rejects a manifest missing the compatibility fields', () => {
    const { dataRevision: _dr, ...rest } = valid;
    expect(() => datasetManifestSchema.parse(rest)).toThrow();
    const { calculatorId: _cid, ...rest2 } = valid;
    expect(() => datasetManifestSchema.parse(rest2)).toThrow();
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
