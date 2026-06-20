// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WzDataSource } from '../../src/parser/WzDataSource';
import type { GameDataSource } from '../../src/parser';
import { Sqlite } from '@scrolled/game-db/db/sqlite';
import { DbApi } from '@scrolled/game-db/db/queries';
import { runExtraction } from '../../src/builder/runExtraction';
import { gatherSourceFiles } from '../../src/builder/files';
import { writeDatasetRepo } from '../../src/builder/pack';
import { datasetManifestSchema, packDataset, readDataset } from '@scrolled/dataset-core';
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

  it('bakes the profile into the game DB, packs a bundle + manifest, and reinstalls', async () => {
    // The CLI bakes the server profile into the dataset's own game DB before
    // export, so it travels as the dataset rather than as a separate member.
    const profile = {
      id: 'mapleroyals',
      name: 'MapleRoyals',
      rates: { exp: 3 },
      systems: { equipStatCalculation: 'mapleroyals-v1' },
    };
    await db.setServerProfileConfig(profile);
    const gameBytes = await db.exportBytes();
    const status = await db.status();

    const bundle = await packDataset({
      game: gameBytes,
      schemaVersion: status.schemaVersion,
      dataRevision: status.dataRevision,
      createdAt: new Date().toISOString(),
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
        calculatorId: profile.systems.equipStatCalculation,
        dataRevision: status.dataRevision,
        schemaVersion: status.schemaVersion,
        bundle,
      });

      // Manifest carries the full, non-null compatibility contract.
      datasetManifestSchema.parse(manifest);
      expect(manifest.dataRevision).toBe(status.dataRevision);
      expect(manifest.schemaVersion).toBe(status.schemaVersion);
      expect(manifest.serverProfileId).toBe('mapleroyals');
      expect(manifest.calculatorId).toBe('mapleroyals-v1');
      expect(manifest.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);

      // Reinstalling the bundle's game bytes into a fresh DB yields populated
      // tables AND the baked-in profile — no separate apply step.
      const onDisk = new Uint8Array(readFileSync(artifactPath));
      const contents = await readDataset(onDisk);
      const fresh = new DbApi(new Sqlite({ logTag: 'reinstall-test' }));
      await fresh.open();
      await fresh.importBytes(contents.game);
      const freshStatus = await fresh.status();
      expect(freshStatus.counts.items).toBeGreaterThan(0);
      expect(freshStatus.dataRevision).toBe(status.dataRevision);
      expect(await fresh.getActiveServerProfile()).toMatchObject({ id: 'mapleroyals' });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 30_000);
});
