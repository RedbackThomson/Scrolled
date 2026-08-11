import { describe, expect, it } from 'vitest';
import { defineGraph } from '../dsl/builder';
import { item, level, meso, quest } from '../dsl/requirements';
import { collectUnlockables, lockedRequirementsFilter } from './unlockables';
import type { TravelEdge } from '../ir/types';

function graph() {
  return defineGraph({ profileId: 'test' }, (g) => {
    const a = g.node('a', 'Alpha');
    const b = g.node('b', 'Beta');
    const c = g.node('c', 'Gamma');
    a.itemTo(b, {
      require: [item(2_000_001, { consumed: true, name: 'Lighthouse Pass' }), level(10)],
    });
    b.npcTo(c, { require: [quest(7_001, 'Summit Survey'), meso(500)] });
    // A second edge referencing the same item, this time unnamed.
    a.itemTo(c, { require: [item(2_000_001)] });
  });
}

describe('collectUnlockables', () => {
  it('returns one entry per distinct item/quest, ignoring meso/level', () => {
    const entries = collectUnlockables(graph());
    expect(entries).toEqual([
      { key: 'item:2000001', kind: 'item', id: 2_000_001, name: 'Lighthouse Pass' },
      { key: 'quest:7001', kind: 'quest', id: 7_001, name: 'Summit Survey' },
    ]);
  });

  it('prefers a named occurrence regardless of edge order', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      const c = g.node('c', 'Gamma');
      a.itemTo(b, { require: [item(42)] }); // anonymous first
      b.itemTo(c, { require: [item(42, { name: 'Warp Rock' })] });
    });
    expect(collectUnlockables(source)).toEqual([
      { key: 'item:42', kind: 'item', id: 42, name: 'Warp Rock' },
    ]);
  });

  it('returns nothing for a graph that gates on no requirements', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.walk(b);
    });
    expect(collectUnlockables(source)).toEqual([]);
  });
});

describe('lockedRequirementsFilter', () => {
  const itemEdge = { requirements: [item(2_000_001, { consumed: true })] } as TravelEdge;
  const questEdge = { requirements: [quest(7_001)] } as TravelEdge;
  const scalarEdge = { requirements: [level(10), meso(500)] } as TravelEdge;
  const plainEdge = {} as TravelEdge;

  it('passes every edge when nothing is locked', () => {
    const eligible = lockedRequirementsFilter(new Set());
    expect([itemEdge, questEdge, scalarEdge, plainEdge].every(eligible)).toBe(true);
  });

  it('blocks only edges requiring a locked subject', () => {
    const eligible = lockedRequirementsFilter(new Set(['item:2000001']));
    expect(eligible(itemEdge)).toBe(false);
    expect(eligible(questEdge)).toBe(true);
  });

  it('never blocks on meso or level requirements', () => {
    const eligible = lockedRequirementsFilter(new Set(['item:2000001', 'quest:7001']));
    expect(eligible(scalarEdge)).toBe(true);
    expect(eligible(plainEdge)).toBe(true);
  });
});
