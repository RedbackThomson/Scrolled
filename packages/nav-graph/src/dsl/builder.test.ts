import { describe, expect, it } from 'vitest';
import { defineGraph } from './builder';
import { item, level, meso, quest } from './requirements';

describe('defineGraph', () => {
  it('emits a minimal NavGraphSource with bidirectional walk default', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.walk(b);
    });

    expect(source.profileId).toBe('test');
    expect(source.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(source.edges).toHaveLength(1);
    expect(source.edges[0]).toMatchObject({
      from: 'a',
      to: 'b',
      method: 'walk',
      bidirectional: true,
    });
  });

  it('respects region scoping for group assignment', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      g.region('north', 'Northland', (r) => {
        r.node('a', 'Alpha');
        r.node('b', 'Beta');
      });
      g.node('c', 'Gamma');
    });

    expect(source.nodes.find((n) => n.id === 'a')?.group).toBe('north');
    expect(source.nodes.find((n) => n.id === 'b')?.group).toBe('north');
    expect(source.nodes.find((n) => n.id === 'c')?.group).toBeUndefined();
    expect(source.groups).toContainEqual({ id: 'north', name: 'Northland' });
  });

  it('npcTo defaults directed; walk defaults bidirectional', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.npcTo(b, { via: 'Talk to the porter' });
      a.walk(b);
    });

    const npc = source.edges.find((e) => e.method === 'npc');
    const walk = source.edges.find((e) => e.method === 'walk');
    expect(npc?.bidirectional).toBeUndefined();
    expect(walk?.bidirectional).toBe(true);
  });

  it('`both` overrides the verb default in both directions', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.npcTo(b, { both: true });
      a.walk(b, { both: false });
    });

    const npc = source.edges.find((e) => e.method === 'npc');
    const walk = source.edges.find((e) => e.method === 'walk');
    expect(npc?.bidirectional).toBe(true);
    expect(walk?.bidirectional).toBeUndefined();
  });

  it('transportTo emits a bidirectional transport edge carrying via + seconds', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.transportTo(b, { via: 'Ferry to Beta', seconds: 120 });
    });

    expect(source.edges[0]).toMatchObject({
      from: 'a',
      to: 'b',
      method: 'transport',
      bidirectional: true,
      via: 'Ferry to Beta',
      seconds: 120,
    });
  });

  it('merges cost + require into one requirements list', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.itemTo(b, {
        cost: meso(1000),
        require: [item(4031746, { consumed: true }), level(30), quest(7)],
      });
    });

    expect(source.edges[0].requirements).toEqual([
      { kind: 'meso', amount: 1000 },
      { kind: 'item', itemId: 4031746, consumed: true },
      { kind: 'level', min: 30 },
      { kind: 'quest', questId: 7 },
    ]);
  });

  it('g.ref() resolves forward and cross-region references', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      // declare an edge whose target is declared later
      const a = g.node('a', 'Alpha');
      const futureB = g.ref('b');
      a.walk(futureB);
      g.node('b', 'Beta');
    });

    expect(source.edges[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('throws on duplicate node ids with declaration indices', () => {
    expect(() =>
      defineGraph({ profileId: 'test' }, (g) => {
        g.node('a', 'Alpha');
        g.node('b', 'Beta');
        g.node('a', 'Alpha 2');
      }),
    ).toThrow(/Duplicate node id\(s\): a \(declarations #0, #2\)/);
  });

  it('throws on edges to undeclared nodes', () => {
    expect(() =>
      defineGraph({ profileId: 'test' }, (g) => {
        const a = g.node('a', 'Alpha');
        const phantom = g.ref('ghost');
        a.walk(phantom);
      }),
    ).toThrow(/undeclared nodes.*ghost/);
  });

  it('throws when a node references an unknown group', () => {
    expect(() =>
      defineGraph({ profileId: 'test' }, (g) => {
        g.node('a', 'Alpha', { group: 'phantom' });
      }),
    ).toThrow(/unknown group "phantom"/);
  });

  it('records refs and notes on the emitted edge', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.npcTo(b, {
        via: 'Take the cab',
        ref: { npcId: 1012000 },
        notes: 'fast-travel',
      });
    });
    expect(source.edges[0]).toMatchObject({
      via: 'Take the cab',
      refs: { npcId: 1012000 },
      notes: 'fast-travel',
    });
  });
});
