// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { extractSkills } from './extractSkills';
import type { GameDataSource, WzNodeInfo } from '@/parser';

/**
 * Synthetic raw-tree stub of the WZ surface extractSkills reads. Models
 * `Skill.wz/<jobId>.img/skill/<skillId>/{common,elemAttr,weapon,req,level/<N>/<field>}`
 * plus the identity strings at `String.wz/Skill.img/<skillId>/{name,desc,h…}`.
 *
 * Methods extractSkills doesn't call throw so a future regression that
 * adds new reads is loud rather than silently passing.
 */
function makeSource(
  tree: Record<string, WzNodeInfo[]>,
  nodes: Record<string, WzNodeInfo>,
): GameDataSource {
  return {
    init: async () => {},
    load: async () => ({ loaded: [], errors: [] }),
    listFiles: async () => [],
    listChildren: async (path) => tree[path] ?? [],
    getNode: async (path) => nodes[path] ?? null,
    getIconPng: async () => null,
    readImageTree: async () => null,
    diagnose: async () => ({ log: [], aesSmokeTest: { ok: true }, loadedFiles: [] }),
    dispose: async () => {},
  };
}

function leaf(
  name: string,
  fullPath: string,
  scalar: string | number,
  propertyKind: 'int' | 'string' = typeof scalar === 'string' ? 'string' : 'int',
): WzNodeInfo {
  return {
    name,
    fullPath,
    kind: 'property',
    propertyKind,
    hasChildren: false,
    scalar,
  };
}

describe('extractSkills', () => {
  it('joins identity strings and reads a level table', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '200.img', fullPath: 'Skill.wz/200.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/200.img/skill': [
          { name: '2001005', fullPath: 'Skill.wz/200.img/skill/2001005', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/200.img/skill/2001005/req': [],
        'Skill.wz/200.img/skill/2001005/level': [
          { name: '1', fullPath: 'Skill.wz/200.img/skill/2001005/level/1', kind: 'property', hasChildren: true },
          { name: '2', fullPath: 'Skill.wz/200.img/skill/2001005/level/2', kind: 'property', hasChildren: true },
          { name: '3', fullPath: 'Skill.wz/200.img/skill/2001005/level/3', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/200.img/skill/2001005/level/1': [
          leaf('mpCon', '', 12),
          leaf('damage', '', 100),
          leaf('time', '', 0),
          leaf('mysteryField', '', 7),
        ],
        'Skill.wz/200.img/skill/2001005/level/2': [
          leaf('mpCon', '', 14),
          leaf('damage', '', 110),
        ],
        'Skill.wz/200.img/skill/2001005/level/3': [
          leaf('mpCon', '', 16),
          leaf('damage', '', 120),
        ],
      },
      {
        'String.wz/Skill.img/2001005/name': leaf('name', '', 'Magic Claw', 'string'),
        'String.wz/Skill.img/2001005/desc': leaf('desc', '', 'Hurls magical bolts.', 'string'),
        'String.wz/Skill.img/2001005/h': leaf('h', '', 'MP -#mpCon. Hits #attackCount times.', 'string'),
        'Skill.wz/200.img/skill/2001005/common/maxLevel': leaf('maxLevel', '', 20),
        'Skill.wz/200.img/skill/2001005/common/invisible': leaf('invisible', '', 0),
        'Skill.wz/200.img/skill/2001005/elemAttr': leaf('elemAttr', '', 'F', 'string'),
        'Skill.wz/200.img/skill/2001005/weapon': leaf('weapon', '', 37),
      },
    );

    const result = await extractSkills(source);

    expect(result.skills).toHaveLength(1);
    const skill = result.skills[0];
    expect(skill.id).toBe(2001005);
    expect(skill.jobId).toBe(200);
    expect(skill.name).toBe('Magic Claw');
    expect(skill.description).toBe('Hurls magical bolts.');
    expect(skill.tooltip).toBe('MP -#mpCon. Hits #attackCount times.');
    expect(skill.maxLevel).toBe(20);
    expect(skill.hidden).toBe(false);
    expect(skill.element).toBe('F');
    expect(skill.requiredWeapon).toBe('37');

    expect(result.levels).toHaveLength(3);
    const lvl1 = result.levels.find((l) => l.level === 1);
    expect(lvl1?.mpCost).toBe(12);
    expect(lvl1?.damagePercent).toBe(100);
    expect(lvl1?.rawJson).toContain('mysteryField');
    expect(JSON.parse(lvl1!.rawJson as string)).toEqual({ mysteryField: 7 });

    expect(result.prerequisites).toEqual([]);
  });

  it('falls back through h1/h2 when h is missing', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '210.img', fullPath: 'Skill.wz/210.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/210.img/skill': [
          { name: '2100000', fullPath: 'Skill.wz/210.img/skill/2100000', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/210.img/skill/2100000/req': [],
        'Skill.wz/210.img/skill/2100000/level': [],
      },
      {
        'String.wz/Skill.img/2100000/h1': leaf('h1', '', 'Boosts magic attack.', 'string'),
        'String.wz/Skill.img/2100000/h2': leaf('h2', '', 'Tooltip line two.', 'string'),
      },
    );

    const result = await extractSkills(source);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].tooltip).toBe('Boosts magic attack.');
    expect(result.skills[0].name).toBeNull();
  });

  it('emits one prerequisite row per req entry', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '300.img', fullPath: 'Skill.wz/300.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/300.img/skill': [
          { name: '3000000', fullPath: 'Skill.wz/300.img/skill/3000000', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/300.img/skill/3000000/req': [
          leaf('2901001', 'Skill.wz/300.img/skill/3000000/req/2901001', 5),
          leaf('2901002', 'Skill.wz/300.img/skill/3000000/req/2901002', 3),
        ],
        'Skill.wz/300.img/skill/3000000/level': [],
      },
      {
        'String.wz/Skill.img/3000000/name': leaf('name', '', 'Final Attack', 'string'),
      },
    );

    const result = await extractSkills(source);
    expect(result.prerequisites).toEqual([
      { skillId: 3000000, requiredSkillId: 2901001, requiredLevel: 5 },
      { skillId: 3000000, requiredSkillId: 2901002, requiredLevel: 3 },
    ]);
  });

  it('skips non-numeric job-file names like BookSkill.img', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: 'BookSkill.img', fullPath: 'Skill.wz/BookSkill.img', kind: 'image', hasChildren: true },
          { name: '400.img', fullPath: 'Skill.wz/400.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/400.img/skill': [
          { name: '4001001', fullPath: 'Skill.wz/400.img/skill/4001001', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/400.img/skill/4001001/req': [],
        'Skill.wz/400.img/skill/4001001/level': [],
      },
      {
        'String.wz/Skill.img/4001001/name': leaf('name', '', "Lucky Seven", 'string'),
      },
    );

    const result = await extractSkills(source);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].jobId).toBe(400);
  });

  it('records hidden=true when common/invisible is 1', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '500.img', fullPath: 'Skill.wz/500.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/500.img/skill': [
          { name: '5000000', fullPath: 'Skill.wz/500.img/skill/5000000', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/500.img/skill/5000000/req': [],
        'Skill.wz/500.img/skill/5000000/level': [],
      },
      {
        'String.wz/Skill.img/5000000/name': leaf('name', '', 'Hidden Buff', 'string'),
        'Skill.wz/500.img/skill/5000000/common/invisible': leaf('invisible', '', 1),
      },
    );

    const result = await extractSkills(source);
    expect(result.skills[0].hidden).toBe(true);
  });

  it('returns empty result when Skill.wz is absent', async () => {
    const source = makeSource({ 'Skill.wz': [] }, {});
    const result = await extractSkills(source);
    expect(result.skills).toEqual([]);
    expect(result.levels).toEqual([]);
    expect(result.prerequisites).toEqual([]);
  });

  it('orders level rows by their level number, not WZ child order', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '600.img', fullPath: 'Skill.wz/600.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/600.img/skill': [
          { name: '6000000', fullPath: 'Skill.wz/600.img/skill/6000000', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/600.img/skill/6000000/req': [],
        'Skill.wz/600.img/skill/6000000/level': [
          { name: '3', fullPath: 'Skill.wz/600.img/skill/6000000/level/3', kind: 'property', hasChildren: true },
          { name: '1', fullPath: 'Skill.wz/600.img/skill/6000000/level/1', kind: 'property', hasChildren: true },
          { name: '2', fullPath: 'Skill.wz/600.img/skill/6000000/level/2', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/600.img/skill/6000000/level/1': [leaf('mpCon', '', 10)],
        'Skill.wz/600.img/skill/6000000/level/2': [leaf('mpCon', '', 12)],
        'Skill.wz/600.img/skill/6000000/level/3': [leaf('mpCon', '', 14)],
      },
      {
        'String.wz/Skill.img/6000000/name': leaf('name', '', 'Test', 'string'),
      },
    );

    const result = await extractSkills(source);
    const byLevel = new Map(result.levels.map((l) => [l.level, l.mpCost]));
    expect(byLevel.get(1)).toBe(10);
    expect(byLevel.get(2)).toBe(12);
    expect(byLevel.get(3)).toBe(14);
  });
});
