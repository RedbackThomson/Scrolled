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

  it('unescapes \\n in description and tooltip strings', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '220.img', fullPath: 'Skill.wz/220.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/220.img/skill': [
          { name: '2200000', fullPath: 'Skill.wz/220.img/skill/2200000', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/220.img/skill/2200000/req': [],
        'Skill.wz/220.img/skill/2200000/level': [],
      },
      {
        'String.wz/Skill.img/2200000/desc': leaf(
          'desc',
          '',
          'First line.\\nSecond line.\\nThird line.',
          'string',
        ),
        'String.wz/Skill.img/2200000/h': leaf('h', '', 'Top.\\nBottom.', 'string'),
      },
    );

    const result = await extractSkills(source);
    expect(result.skills[0].description).toBe('First line.\nSecond line.\nThird line.');
    expect(result.skills[0].tooltip).toBe('Top.\nBottom.');
  });

  it('stores h<level> strings as per-level static descriptions (older WZ pattern)', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '210.img', fullPath: 'Skill.wz/210.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/210.img/skill': [
          { name: '2100000', fullPath: 'Skill.wz/210.img/skill/2100000', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/210.img/skill/2100000/req': [],
        'Skill.wz/210.img/skill/2100000/level': [
          { name: '1', fullPath: 'Skill.wz/210.img/skill/2100000/level/1', kind: 'property', hasChildren: true },
          { name: '2', fullPath: 'Skill.wz/210.img/skill/2100000/level/2', kind: 'property', hasChildren: true },
          { name: '3', fullPath: 'Skill.wz/210.img/skill/2100000/level/3', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/210.img/skill/2100000/level/1': [],
        'Skill.wz/210.img/skill/2100000/level/2': [],
        'Skill.wz/210.img/skill/2100000/level/3': [],
        'String.wz/Skill.img/2100000': [
          leaf('h1', 'String.wz/Skill.img/2100000/h1', 'Accuracy +1', 'string'),
          leaf('h2', 'String.wz/Skill.img/2100000/h2', 'Accuracy +2', 'string'),
          leaf('h3', 'String.wz/Skill.img/2100000/h3', 'Accuracy +3', 'string'),
        ],
      },
      {
        'String.wz/Skill.img/2100000/h1': leaf('h1', '', 'Accuracy +1', 'string'),
        'String.wz/Skill.img/2100000/h2': leaf('h2', '', 'Accuracy +2', 'string'),
        'String.wz/Skill.img/2100000/h3': leaf('h3', '', 'Accuracy +3', 'string'),
      },
    );

    const result = await extractSkills(source);
    expect(result.skills).toHaveLength(1);
    // No `h` → parent tooltip stays null; descriptions attach to each level.
    expect(result.skills[0].tooltip).toBeNull();
    const byLevel = new Map(result.levels.map((l) => [l.level, l.description]));
    expect(byLevel.get(1)).toBe('Accuracy +1');
    expect(byLevel.get(2)).toBe('Accuracy +2');
    expect(byLevel.get(3)).toBe('Accuracy +3');
  });

  it('leaves level.description null when only a templated h exists (modern pattern)', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '230.img', fullPath: 'Skill.wz/230.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/230.img/skill': [
          { name: '2301003', fullPath: 'Skill.wz/230.img/skill/2301003', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/230.img/skill/2301003/req': [],
        'Skill.wz/230.img/skill/2301003/level': [
          { name: '1', fullPath: 'Skill.wz/230.img/skill/2301003/level/1', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/230.img/skill/2301003/level/1': [],
        'String.wz/Skill.img/2301003': [
          leaf('h', 'String.wz/Skill.img/2301003/h', 'Increase Max HP by #x%.', 'string'),
        ],
      },
      {
        'String.wz/Skill.img/2301003/h': leaf('h', '', 'Increase Max HP by #x%.', 'string'),
      },
    );

    const result = await extractSkills(source);
    expect(result.skills[0].tooltip).toBe('Increase Max HP by #x%.');
    expect(result.levels[0].description).toBeNull();
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

  it('falls back to the highest level when common/maxLevel is missing', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '700.img', fullPath: 'Skill.wz/700.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/700.img/skill': [
          { name: '7000000', fullPath: 'Skill.wz/700.img/skill/7000000', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/700.img/skill/7000000/req': [],
        'Skill.wz/700.img/skill/7000000/level': [
          { name: '1', fullPath: 'Skill.wz/700.img/skill/7000000/level/1', kind: 'property', hasChildren: true },
          { name: '15', fullPath: 'Skill.wz/700.img/skill/7000000/level/15', kind: 'property', hasChildren: true },
          { name: '20', fullPath: 'Skill.wz/700.img/skill/7000000/level/20', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/700.img/skill/7000000/level/1': [leaf('mpCon', '', 10)],
        'Skill.wz/700.img/skill/7000000/level/15': [leaf('mpCon', '', 24)],
        'Skill.wz/700.img/skill/7000000/level/20': [leaf('mpCon', '', 30)],
      },
      {
        'String.wz/Skill.img/7000000/name': leaf('name', '', 'No Max', 'string'),
      },
    );

    const result = await extractSkills(source);
    expect(result.skills[0].maxLevel).toBe(20);
  });

  it('prefers common/maxLevel over the inferred highest level', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '710.img', fullPath: 'Skill.wz/710.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/710.img/skill': [
          { name: '7100000', fullPath: 'Skill.wz/710.img/skill/7100000', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/710.img/skill/7100000/req': [],
        'Skill.wz/710.img/skill/7100000/level': [
          { name: '1', fullPath: 'Skill.wz/710.img/skill/7100000/level/1', kind: 'property', hasChildren: true },
          { name: '2', fullPath: 'Skill.wz/710.img/skill/7100000/level/2', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/710.img/skill/7100000/level/1': [leaf('mpCon', '', 10)],
        'Skill.wz/710.img/skill/7100000/level/2': [leaf('mpCon', '', 12)],
      },
      {
        'String.wz/Skill.img/7100000/name': leaf('name', '', 'Capped', 'string'),
        'Skill.wz/710.img/skill/7100000/common/maxLevel': leaf('maxLevel', '', 30),
      },
    );

    const result = await extractSkills(source);
    expect(result.skills[0].maxLevel).toBe(30);
  });

  it('leaves maxLevel null when no levels and no common/maxLevel exist', async () => {
    const source = makeSource(
      {
        'Skill.wz': [
          { name: '720.img', fullPath: 'Skill.wz/720.img', kind: 'image', hasChildren: true },
        ],
        'Skill.wz/720.img/skill': [
          { name: '7200000', fullPath: 'Skill.wz/720.img/skill/7200000', kind: 'property', hasChildren: true },
        ],
        'Skill.wz/720.img/skill/7200000/req': [],
        'Skill.wz/720.img/skill/7200000/level': [],
      },
      {
        'String.wz/Skill.img/7200000/name': leaf('name', '', 'Empty', 'string'),
      },
    );

    const result = await extractSkills(source);
    expect(result.skills[0].maxLevel).toBeNull();
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
