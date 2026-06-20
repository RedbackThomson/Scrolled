// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WzDataSource } from '../../src/parser/WzDataSource';
import type { GameDataSource } from '../../src/parser';
import { Sqlite } from '../../src/db/sqlite';
import { DbApi } from '../../src/db/queries';
import { packBackup, readBackup } from '../../src/db/backup';
import { resolveServerProfile } from '../../src/serverProfiles';
import { runExtraction } from '../../src/builder/runExtraction';
import { gatherSourceFiles } from '../../src/builder/files';
import { writeDatasetRepo } from '../../src/builder/pack';
import { datasetManifestSchema } from '@scrolled/dataset-core';
import { wzVersionFromEnv } from '../helpers/localFixtures';

/**
 * End-to-end headless build against real WZ fixtures: runs the same
 * `runExtraction` pipeline the CLI drives, against an in-memory SQLite, and
 * checks the export is a valid SQLite file with populated tables. Skips
 * cleanly when no fixtures are present (CI).
 */
const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/wz');

const wzFiles = existsSync(FIXTURES_DIR) ? gatherSourceFiles(FIXTURES_DIR, 'wz') : [];
// Need at least String.wz (names) + one content file to produce rows.
const hasEnough =
  wzFiles.some((f) => /^String\.wz$/i.test(f.name)) &&
  wzFiles.some((f) => /^(Item|Mob|Npc)\.wz$/i.test(f.name));

describe.skipIf(!hasEnough)('headless build — real WZ fixtures', () => {
  let source: GameDataSource;
  let db: DbApi;
  let bytes: Uint8Array;

  beforeAll(async () => {
    source = new WzDataSource();
    await source.init(wzVersionFromEnv(), 'wz');
    const loaded = await source.load(wzFiles);
    if (loaded.errors.length > 0) {
      throw new Error(`load errors: ${loaded.errors.map((e) => e.name).join(', ')}`);
    }
    db = new DbApi(new Sqlite({ logTag: 'build-test' }));
    await db.open();
    await runExtraction(source, db, {
      label: 'test build',
      wzVersion: wzVersionFromEnv(),
      sourceKind: 'wz',
      files: wzFiles.map((f) => ({ name: f.name, size: null, hash: null, loadStatus: null, loadError: null })),
    });
    bytes = await db.exportBytes();
  }, 60_000);

  afterAll(async () => {
    await source?.dispose();
  });

  it('exports a valid SQLite file', () => {
    const magic = new TextDecoder().decode(bytes.slice(0, 15));
    expect(magic).toBe('SQLite format 3');
  });

  it('populates at least one entity table and stamps the data revision', async () => {
    const status = await db.status();
    const total =
      status.counts.items + status.counts.mobs + status.counts.npcs + status.counts.maps;
    expect(total).toBeGreaterThan(0);
    expect(status.dataRevision).toBeGreaterThan(0);
  });

  it('records a dataset row', async () => {
    const datasets = await db.listDatasets();
    expect(datasets.length).toBe(1);
    expect(datasets[0]!.label).toBe('test build');
  });

  it('packs a bundle + generates a manifest, and reinstalls into a fresh DB', async () => {
    const profile = resolveServerProfile('mapleroyals-compatible');
    const status = await db.status();
    const bundle = await packBackup({
      game: bytes,
      versions: { game: { schemaVersion: status.schemaVersion, dataRevision: status.dataRevision } },
      serverProfile: profile,
    });

    // Generate the host-side repo layout from the bundle.
    const out = mkdtempSync(resolve(tmpdir(), 'scrolled-ds-'));
    try {
      const { manifest, artifactPath } = writeDatasetRepo({
        out,
        family: 'mapleroyals',
        version: '2026-06-01',
        displayName: 'MapleRoyals',
        serverProfileId: profile.id,
        calculatorId: profile.systems.equipStatCalculation!,
        dataRevision: status.dataRevision,
        schemaVersion: status.schemaVersion,
        bundle,
      });

      // Manifest carries the full, non-null compatibility contract.
      datasetManifestSchema.parse(manifest);
      expect(manifest.dataRevision).toBe(status.dataRevision);
      expect(manifest.schemaVersion).toBe(status.schemaVersion);
      expect(manifest.serverProfileId).toBe('mapleroyals-compatible');
      expect(manifest.calculatorId).toBe('mapleroyals-v1');
      expect(manifest.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);

      // The artifact on disk reads back: game bytes + inline profile.
      const onDisk = new Uint8Array(readFileSync(artifactPath));
      const contents = await readBackup(onDisk);
      expect(contents.serverProfile).toMatchObject({ id: 'mapleroyals-compatible' });

      // Reinstalling the game bytes into a fresh DB yields populated tables.
      const fresh = new DbApi(new Sqlite({ logTag: 'reinstall-test' }));
      await fresh.open();
      await fresh.importBytes(contents.game!);
      const freshStatus = await fresh.status();
      expect(freshStatus.counts.items).toBeGreaterThan(0);
      expect(freshStatus.dataRevision).toBe(status.dataRevision);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 30_000);
});
