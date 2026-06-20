import { describe, it, expect } from 'vitest';
import type { DatasetManifest } from '@scrolled/dataset-core';
import { CURRENT_DATA_REVISION } from '@scrolled/extractor/db';
import { LATEST_SCHEMA_VERSION } from '@scrolled/extractor/db/migrations';
import { assertDatasetSupported } from './registry';
import { isAppUpdateRequired } from './errors';

// A manifest this build supports: a calculator it ships, at revisions/schema
// within range. The server profile travels in the bundle, so its id can be
// anything — it is deliberately not gated here.
const supported: DatasetManifest = {
  id: 'mapleroyals-2026-06-01',
  family: 'mapleroyals',
  version: '2026-06-01',
  displayName: 'MapleRoyals',
  serverProfileId: 'mapleroyals',
  calculatorId: 'mapleroyals-v1',
  dataRevision: CURRENT_DATA_REVISION,
  schemaVersion: LATEST_SCHEMA_VERSION,
  artifact: { url: 'mapleroyals/2026-06-01/mapleroyals-2026-06-01.scrolled-dataset' },
};

describe('assertDatasetSupported', () => {
  it('accepts a manifest this build supports', () => {
    expect(() => assertDatasetSupported(supported)).not.toThrow();
  });

  it('accepts a profile id this build does not ship (it travels in the bundle)', () => {
    const m = { ...supported, serverProfileId: 'some-server-not-in-this-build' };
    expect(() => assertDatasetSupported(m)).not.toThrow();
  });

  it('refuses an unknown stat calculator as "update the app"', () => {
    const m = { ...supported, calculatorId: 'some-future-calculator' };
    expect(() => assertDatasetSupported(m)).toThrow(/calculator/);
    try {
      assertDatasetSupported(m);
    } catch (e) {
      expect(isAppUpdateRequired(e)).toBe(true);
    }
  });

  it('refuses a newer schema version', () => {
    const m = { ...supported, schemaVersion: LATEST_SCHEMA_VERSION + 1 };
    expect(() => assertDatasetSupported(m)).toThrow(/database format/);
  });

  it('refuses a newer data revision', () => {
    const m = { ...supported, dataRevision: CURRENT_DATA_REVISION + 1 };
    expect(() => assertDatasetSupported(m)).toThrow(/newer version/);
  });
});
