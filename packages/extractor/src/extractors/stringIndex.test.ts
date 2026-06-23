// @vitest-environment node
import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildEquipStringIndex,
  buildItemStringIndex,
  buildMapStringIndex,
  buildQuestStringIndex,
} from './stringIndex';
import { clearLog, getLogEntries } from '@scrolled/game-db/lib/logger';
import type { GameDataSource, WzNodeInfo, WzNodeTree } from '../parser';

/**
 * Synthetic `String.wz` tree fixtures — no proprietary data. `images` keys an
 * already-parsed `WzNodeTree` per `readImageTree` path; `children` backs
 * `listChildren`. Methods the builders don't call throw so a future read is
 * loud rather than silently passing.
 */
function makeSource(
  images: Record<string, WzNodeTree>,
  children: Record<string, WzNodeInfo[]> = {},
): GameDataSource {
  return {
    init: async () => {},
    load: async () => ({ loaded: [], errors: [] }),
    listFiles: async () => [],
    listChildren: async (path) => children[path] ?? [],
    getNode: async () => {
      throw new Error('getNode not expected');
    },
    getIconPng: async () => null,
    getIconRgba: async () => null,
    readImageTree: async (path) => images[path] ?? null,
    diagnose: async () => ({ log: [], aesSmokeTest: { ok: true }, loadedFiles: [] }),
    dispose: async () => {},
  };
}

/** Build a numeric entity node with string-valued children (name/desc/…). */
function entity(id: string, base: string, fields: Record<string, string>): WzNodeTree {
  const fullPath = `${base}/${id}`;
  return {
    name: id,
    fullPath,
    kind: 'property',
    propertyKind: 'sub',
    hasChildren: true,
    children: Object.entries(fields).map(([k, v]) => ({
      name: k,
      fullPath: `${fullPath}/${k}`,
      kind: 'property',
      propertyKind: 'string',
      hasChildren: false,
      scalar: v,
      children: [],
    })),
  };
}

/** A non-leaf bucket node (the `Eqp` wrapper, a slot, a region, an image root). */
function bucket(
  name: string,
  fullPath: string,
  children: WzNodeTree[],
  kind: WzNodeTree['kind'] = 'property',
): WzNodeTree {
  return { name, fullPath, kind, propertyKind: 'sub', hasChildren: children.length > 0, children };
}

beforeEach(() => clearLog());

describe('buildEquipStringIndex', () => {
  it('resolves Ring of Alchemist (1112400) from the Accessory bucket regardless of slot', async () => {
    // The ring lives under `Accessory` in String.wz even though Character.wz
    // files it under a `Ring` directory — this is the regression case.
    const eqp = bucket(
      'Eqp.img',
      'String.wz/Eqp.img',
      [
        bucket('Eqp', 'String.wz/Eqp.img/Eqp', [
          bucket('Accessory', 'String.wz/Eqp.img/Eqp/Accessory', [
            entity('1112400', 'String.wz/Eqp.img/Eqp/Accessory', {
              name: 'Ring of Alchemist',
              desc: 'A shiny ring.',
            }),
          ]),
          bucket('Cap', 'String.wz/Eqp.img/Eqp/Cap', [
            entity('1002000', 'String.wz/Eqp.img/Eqp/Cap', { name: 'Bandana' }),
          ]),
        ]),
      ],
      'image',
    );

    const index = await buildEquipStringIndex(makeSource({ 'String.wz/Eqp.img': eqp }));

    expect(index.get(1112400)?.name).toBe('Ring of Alchemist');
    expect(index.get(1112400)?.path).toBe('String.wz/Eqp.img/Eqp/Accessory/1112400');
    expect(index.get(1112400)?.category).toBe('Accessory');
    expect(index.get(1112400)?.desc).toBe('A shiny ring.');
    // A name-only equip in another bucket still resolves.
    expect(index.get(1002000)?.name).toBe('Bandana');
    expect(index.get(1002000)?.desc).toBeNull();
  });

  it('warns about an empty index when String.wz/Eqp.img is missing', async () => {
    const index = await buildEquipStringIndex(makeSource({}));
    expect(index.size).toBe(0);
    expect(getLogEntries().some((e) => e.level === 'warn' && /Eqp\.img not found/.test(e.msg))).toBe(
      true,
    );
  });
});

describe('duplicate resolution', () => {
  it('prefers the candidate with both name and desc and logs the duplicate', async () => {
    // Same id under two buckets: the first has name only, the second adds a desc.
    const eqp = bucket(
      'Eqp.img',
      'String.wz/Eqp.img',
      [
        bucket('Eqp', 'String.wz/Eqp.img/Eqp', [
          bucket('Ring', 'String.wz/Eqp.img/Eqp/Ring', [
            entity('1112400', 'String.wz/Eqp.img/Eqp/Ring', { name: 'Ring of Alchemist' }),
          ]),
          bucket('Accessory', 'String.wz/Eqp.img/Eqp/Accessory', [
            entity('1112400', 'String.wz/Eqp.img/Eqp/Accessory', {
              name: 'Ring of Alchemist',
              desc: 'A shiny ring.',
            }),
          ]),
        ]),
      ],
      'image',
    );

    const index = await buildEquipStringIndex(makeSource({ 'String.wz/Eqp.img': eqp }));

    expect(index.get(1112400)?.category).toBe('Accessory');
    expect(index.get(1112400)?.desc).toBe('A shiny ring.');
    expect(
      getLogEntries().some((e) => e.level === 'warn' && /duplicate string entries/.test(e.msg)),
    ).toBe(true);
  });
});

describe('buildItemStringIndex', () => {
  it('walks flat, single-wrapper and nested layouts and keeps unknown fields', async () => {
    const source = makeSource(
      {
        // Flat: Consume.img/<id>
        'String.wz/Consume.img': bucket(
          'Consume.img',
          'String.wz/Consume.img',
          [
            entity('2000000', 'String.wz/Consume.img', {
              name: 'Red Potion',
              desc: 'Heals HP.',
              extra: 'ignored-but-kept',
            }),
          ],
          'image',
        ),
        // Wrapped: Etc.img/Etc/<id>
        'String.wz/Etc.img': bucket(
          'Etc.img',
          'String.wz/Etc.img',
          [
            bucket('Etc', 'String.wz/Etc.img/Etc', [
              entity('4000000', 'String.wz/Etc.img/Etc', { name: "Snail Shell" }),
            ]),
          ],
          'image',
        ),
      },
      { 'String.wz': [{ name: 'Consume.img' } as WzNodeInfo, { name: 'Etc.img' } as WzNodeInfo] },
    );

    const index = await buildItemStringIndex(source);

    expect(index.get(2000000)?.name).toBe('Red Potion');
    expect(index.get(2000000)?.category).toBe('Consume');
    expect(index.get(2000000)?.raw.extra).toBe('ignored-but-kept');
    expect(index.get(4000000)?.name).toBe('Snail Shell');
    expect(index.get(4000000)?.category).toBe('Etc');
    expect(index.get(9999999)).toBeUndefined();
  });
});

describe('buildMapStringIndex', () => {
  it('keeps mapName and streetName in raw, keyed by id under each region', async () => {
    const map = bucket(
      'Map.img',
      'String.wz/Map.img',
      [
        bucket('victoria', 'String.wz/Map.img/victoria', [
          entity('100000000', 'String.wz/Map.img/victoria', {
            mapName: 'Henesys',
            streetName: 'Henesys Field',
          }),
        ]),
      ],
      'image',
    );

    const index = await buildMapStringIndex(makeSource({ 'String.wz/Map.img': map }));

    expect(index.get(100000000)?.raw.mapName).toBe('Henesys');
    expect(index.get(100000000)?.raw.streetName).toBe('Henesys Field');
  });
});

describe('buildQuestStringIndex', () => {
  it('prefers String.wz/Quest.img over Quest.wz/QuestInfo.img', async () => {
    const source = makeSource(
      {
        'String.wz/Quest.img': bucket(
          'Quest.img',
          'String.wz/Quest.img',
          [
            entity('1000', 'String.wz/Quest.img', {
              name: 'A Real Quest',
              parent: 'Maple Island',
              desc: 'Do the thing.',
            }),
          ],
          'image',
        ),
        'Quest.wz/QuestInfo.img': bucket(
          'QuestInfo.img',
          'Quest.wz/QuestInfo.img',
          [
            entity('1000', 'Quest.wz/QuestInfo.img', { name: 'Stale Name', summary: 'Old blurb.' }),
            entity('2000', 'Quest.wz/QuestInfo.img', { name: 'Fallback Quest', summary: 'Only here.' }),
          ],
          'image',
        ),
      },
      { 'String.wz': [{ name: 'Quest.img' } as WzNodeInfo] },
    );

    const index = await buildQuestStringIndex(source);

    // 1000 exists in both — String.wz wins (it carries name + desc).
    expect(index.get(1000)?.name).toBe('A Real Quest');
    expect(index.get(1000)?.path).toBe('String.wz/Quest.img/1000');
    // 2000 only in QuestInfo — falls back, summary preserved in raw.
    expect(index.get(2000)?.name).toBe('Fallback Quest');
    expect(index.get(2000)?.raw.summary).toBe('Only here.');
  });
});
