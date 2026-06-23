// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractEquips } from './extractEquips';
import type { GameDataSource, WzNodeInfo, WzNodeTree } from '../parser';

/**
 * Regression for the slot/string-bucket mismatch: Character.wz files rings
 * under a `Ring` directory, but String.wz groups their names under
 * `Accessory`. The equip must still resolve its name and be persisted rather
 * than dropped as nameless.
 */
function makeSource(
  children: Record<string, WzNodeInfo[]>,
  images: Record<string, WzNodeTree>,
): GameDataSource {
  return {
    init: async () => {},
    load: async () => ({ loaded: [], errors: [] }),
    listFiles: async () => [],
    listChildren: async (path) => children[path] ?? [],
    getNode: async () => null,
    getIconPng: async () => null,
    getIconRgba: async () => null,
    readImageTree: async (path) => images[path] ?? null,
    diagnose: async () => ({ log: [], aesSmokeTest: { ok: true }, loadedFiles: [] }),
    dispose: async () => {},
  };
}

function dir(name: string, fullPath: string): WzNodeInfo {
  return { name, fullPath, kind: 'directory', hasChildren: true };
}
function img(name: string, fullPath: string): WzNodeInfo {
  return { name, fullPath, kind: 'image', hasChildren: true };
}
function strLeaf(name: string, base: string, value: string): WzNodeTree {
  return {
    name,
    fullPath: `${base}/${name}`,
    kind: 'property',
    propertyKind: 'string',
    hasChildren: false,
    scalar: value,
    children: [],
  };
}
function node(name: string, fullPath: string, children: WzNodeTree[]): WzNodeTree {
  return { name, fullPath, kind: 'property', propertyKind: 'sub', hasChildren: true, children };
}

describe('extractEquips', () => {
  it('resolves a ring whose Character.wz slot differs from its String.wz bucket', async () => {
    const ringBase = 'String.wz/Eqp.img/Eqp/Accessory/1112400';
    const source = makeSource(
      {
        'Character.wz': [dir('Ring', 'Character.wz/Ring')],
        'Character.wz/Ring': [img('01112400.img', 'Character.wz/Ring/01112400.img')],
      },
      {
        'String.wz/Eqp.img': node('Eqp.img', 'String.wz/Eqp.img', [
          node('Eqp', 'String.wz/Eqp.img/Eqp', [
            node('Accessory', 'String.wz/Eqp.img/Eqp/Accessory', [
              node('1112400', ringBase, [
                strLeaf('name', ringBase, 'Ring of Alchemist'),
                strLeaf('desc', ringBase, 'A shiny ring.'),
              ]),
            ]),
          ]),
        ]),
        // readInfo pulls the `info` subtree; an empty info is fine here.
        'Character.wz/Ring/01112400.img': node('01112400.img', 'Character.wz/Ring/01112400.img', [
          node('info', 'Character.wz/Ring/01112400.img/info', []),
        ]),
      },
    );

    const result = await extractEquips(source);

    expect(result.skipped).toEqual([]);
    expect(result.equips).toHaveLength(1);
    const ring = result.equips[0]!;
    expect(ring.id).toBe(1112400);
    expect(ring.name).toBe('Ring of Alchemist');
    expect(ring.description).toBe('A shiny ring.');
    expect(ring.stringPath).toBe(ringBase);
    expect(ring.stringCategory).toBe('Accessory');
  });
});
