// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WzDataSource } from '../../src/parser/WzDataSource';
import {
  getLocalFixture,
  hasLocalFixture,
  wzVersionFromEnv,
  type LocalFixture,
} from '../helpers/localFixtures';

/**
 * Integration test against real MapleRoyals WZ files.
 *
 * These tests only run when files are present in `test/fixtures/wz/`.
 * Drop your own files there; see that directory's README for details. CI runs
 * without the fixtures and these tests skip cleanly.
 */
const REQUIRED = ['String.wz', 'Item.wz'] as const;
const allRequiredPresent = REQUIRED.every((name) => hasLocalFixture(name));

describe.skipIf(!allRequiredPresent)('WzDataSource — real MapleRoyals files', () => {
  let source: WzDataSource;
  const fixtures: LocalFixture[] = [];

  beforeAll(async () => {
    for (const name of REQUIRED) {
      const f = getLocalFixture(name);
      if (f) fixtures.push(f);
    }

    source = new WzDataSource();
    await source.init(wzVersionFromEnv());
    const result = await source.load(fixtures.map((f) => ({ name: f.name, source: f.path })));
    if (result.errors.length > 0) {
      const detail = result.errors.map((e) => `${e.name}: ${e.message}`).join('\n  ');
      throw new Error(`Failed to load fixtures:\n  ${detail}`);
    }
  });

  afterAll(async () => {
    await source?.dispose();
  });

  it('lists each loaded file with at least one root entry', async () => {
    const files = await source.listFiles();
    expect(files.length).toBe(REQUIRED.length);
    for (const f of files) {
      expect(f.kind).toBe('file');
      const children = await source.listChildren(f.fullPath);
      expect(children.length).toBeGreaterThan(0);
    }
  });

  it('resolves a node by its file root path', async () => {
    const node = await source.getNode('String.wz');
    expect(node).not.toBeNull();
    expect(node?.kind).toBe('file');
    expect(node?.hasChildren).toBe(true);
  });

  it('walks one level deeper into String.wz', async () => {
    const children = await source.listChildren('String.wz');
    expect(children.length).toBeGreaterThan(0);
    // Children of String.wz are .img images.
    const kinds = new Set(children.map((c) => c.kind));
    expect(kinds.has('image')).toBe(true);
  });

  it('returns null for paths that do not exist', async () => {
    const node = await source.getNode('String.wz/does-not-exist/at-all');
    expect(node).toBeNull();
  });

  const knownId = process.env.SCROLLED_KNOWN_ITEM_ID;
  const knownName = process.env.SCROLLED_KNOWN_ITEM_NAME;
  it.skipIf(!knownId || !knownName)(
    'resolves a known item to its localized name (SCROLLED_KNOWN_ITEM_ID/NAME)',
    async () => {
      // The "name" property of an item lives under several String.wz paths
      // depending on the entity type. Try the common ones until one resolves.
      const candidates = [
        `String.wz/Item.img/${knownId}/name`,
        `String.wz/Consume.img/${knownId}/name`,
        `String.wz/Etc.img/Etc/${knownId}/name`,
        `String.wz/Eqp.img/Eqp/Cap/${knownId}/name`,
        `String.wz/Eqp.img/Eqp/Weapon/${knownId}/name`,
      ];
      let resolved: string | null = null;
      for (const path of candidates) {
        const node = await source.getNode(path);
        if (node && typeof node.scalar === 'string') {
          resolved = node.scalar;
          break;
        }
      }
      expect(resolved, `none of the candidate paths resolved for ID ${knownId}`).not.toBeNull();
      expect(resolved).toBe(knownName);
    },
  );
});

describe.skipIf(allRequiredPresent)('WzDataSource — real-file tests skipped', () => {
  it('reports that no fixtures are present', () => {
    // Helps surface in CI logs that these tests are deliberately skipped.
    expect(allRequiredPresent).toBe(false);
  });
});
