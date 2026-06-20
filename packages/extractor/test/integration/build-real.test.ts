// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WzDataSource } from '../../src/parser/WzDataSource';
import type { GameDataSource } from '../../src/parser';
import { Sqlite } from '../../src/db/sqlite';
import { DbApi } from '../../src/db/queries';
import { runExtraction } from '../../src/builder/runExtraction';
import { gatherSourceFiles } from '../../src/builder/files';
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
});
