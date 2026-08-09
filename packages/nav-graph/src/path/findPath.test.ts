import { describe, expect, it } from 'vitest';
import { compileGraph } from '../compile/compileGraph';
import { defineGraph } from '../dsl/builder';
import { item, level, meso, quest } from '../dsl/requirements';
import { asNodeId } from '../ir/types';
import { eligibilityFilter } from './eligibility';
import { DEFAULT_TRANSPORT_SECONDS, DEFAULT_WALK_SECONDS, findPath } from './findPath';

const a = asNodeId('a');
const b = asNodeId('b');
const c = asNodeId('c');
const d = asNodeId('d');

describe('findPath — connectivity', () => {
  it('returns an empty step list when from === to', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        g.node('a', 'A');
      }),
    );
    expect(findPath(graph, a, a)).toEqual({ status: 'found', steps: [], totalSeconds: 0 });
  });

  it('finds the fewest-hops path through a chain', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        const nc = g.node('c', 'C');
        na.walk(nb);
        nb.walk(nc);
      }),
    );
    const result = findPath(graph, a, c);
    expect(result.status).toBe('found');
    expect(result.steps.map((s) => `${s.from}->${s.to}`)).toEqual(['a->b', 'b->c']);
  });

  it('prefers a one-hop edge over a two-hop chain', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        const nc = g.node('c', 'C');
        na.walk(nb);
        nb.walk(nc);
        na.portalTo(nc); // one-hop shortcut
      }),
    );
    const result = findPath(graph, a, c);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].method).toBe('portal');
  });

  it('returns `unreachable` for a disconnected destination', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        g.node('a', 'A');
        g.node('b', 'B');
      }),
    );
    expect(findPath(graph, a, b)).toEqual({ status: 'unreachable', steps: [], totalSeconds: 0 });
  });

  it('throws if either endpoint is unknown to the graph', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        g.node('a', 'A');
      }),
    );
    expect(() => findPath(graph, a, asNodeId('ghost'))).toThrow(/undeclared/);
    expect(() => findPath(graph, asNodeId('ghost'), a)).toThrow(/undeclared/);
  });

  it('respects directed edges (does not traverse one-way edges backwards)', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        na.npcTo(nb); // directed
      }),
    );
    expect(findPath(graph, a, b).status).toBe('found');
    expect(findPath(graph, b, a).status).toBe('unreachable');
  });
});

describe('findPath — weighted (travel time)', () => {
  it('routes around a slow walk via more but faster hops', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        const nc = g.node('c', 'C');
        na.walk(nb, { seconds: 500 }); // slow one-hop
        na.walk(nc, { seconds: 10 });
        nc.walk(nb, { seconds: 10 }); // two hops, 20s total — faster
      }),
    );
    const result = findPath(graph, a, b);
    expect(result.status).toBe('found');
    expect(result.steps.map((s) => `${s.from}->${s.to}`)).toEqual(['a->c', 'c->b']);
    expect(result.totalSeconds).toBe(20);
  });

  it('treats non-walk transitions as instant, beating a timed walk', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        na.walk(nb, { seconds: 300 });
        na.portalTo(nb); // instant teleport
      }),
    );
    const result = findPath(graph, a, b);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].method).toBe('portal');
    expect(result.totalSeconds).toBe(0);
  });

  it('falls back to the default time for an untimed walk edge', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        na.walk(nb);
      }),
    );
    expect(findPath(graph, a, b).totalSeconds).toBe(DEFAULT_WALK_SECONDS);
  });

  it('rejects a seconds weight on a non-walk edge at compile time', () => {
    const source = {
      profileId: 'test',
      nodes: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', method: 'npc', seconds: 30 }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hand-written IR bypassing the DSL's type guard
    expect(() => compileGraph(source as any)).toThrow(/seconds is only valid on walk/);
  });
});

describe('findPath — transport & fast travel', () => {
  // A slow one-hop ferry vs. two quick walks (20s total).
  function ferryGraph() {
    return compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        const nc = g.node('c', 'C');
        na.transportTo(nc, { seconds: 300 });
        na.walk(nb, { seconds: 10 });
        nb.walk(nc, { seconds: 10 });
      }),
    );
  }

  it('without fast travel, a slow transport loses to faster walks', () => {
    const result = findPath(ferryGraph(), a, c);
    expect(result.status).toBe('found');
    expect(result.steps.map((s) => `${s.from}->${s.to}`)).toEqual(['a->b', 'b->c']);
    expect(result.totalSeconds).toBe(20);
  });

  it('with fast travel, the transport becomes instant and wins', () => {
    const result = findPath(ferryGraph(), a, c, { fastTravel: true });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].method).toBe('transport');
    expect(result.totalSeconds).toBe(0);
  });

  it('an untimed transport falls back to DEFAULT_TRANSPORT_SECONDS (0 with fast travel)', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        na.transportTo(nb);
      }),
    );
    expect(findPath(graph, a, b).totalSeconds).toBe(DEFAULT_TRANSPORT_SECONDS);
    expect(findPath(graph, a, b, { fastTravel: true }).totalSeconds).toBe(0);
  });

  it('fast travel changes cost, not reachability — a transport is always traversable', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        na.transportTo(nb, { seconds: 120 });
      }),
    );
    // bidirectional by default, reachable with or without fast travel
    expect(findPath(graph, a, b).status).toBe('found');
    expect(findPath(graph, b, a).status).toBe('found');
    expect(findPath(graph, a, b, { fastTravel: true }).status).toBe('found');
  });

  it('accepts a seconds weight on a transport edge at compile time', () => {
    const source = {
      profileId: 'test',
      nodes: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', method: 'transport', seconds: 90 }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hand-written IR
    expect(() => compileGraph(source as any)).not.toThrow();
  });
});

describe('findPath — eligibility', () => {
  function trapGraph() {
    return compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        const nc = g.node('c', 'C');
        const nd = g.node('d', 'D');
        // direct route requires a steep level
        na.itemTo(nc, { require: [level(50)] });
        // detour via b is always available
        na.walk(nb);
        nb.walk(nc);
        // dead-end d that needs an item
        nc.itemTo(nd, { require: [item(1000, { consumed: true })] });
      }),
    );
  }

  it('with no state declared, all edges are eligible', () => {
    const graph = trapGraph();
    const result = findPath(graph, a, c, { eligible: eligibilityFilter({}) });
    expect(result.status).toBe('found');
    // The direct, restricted edge is one hop — fewest-hops wins when nothing blocks it.
    expect(result.steps).toHaveLength(1);
  });

  it('prunes ineligible edges and reroutes through the longer eligible path', () => {
    const graph = trapGraph();
    const result = findPath(graph, a, c, {
      eligible: eligibilityFilter({ level: 10 }),
    });
    expect(result.status).toBe('found');
    expect(result.steps.map((s) => s.method)).toEqual(['walk', 'walk']);
  });

  it('returns unreachable-when-filtered with blocked indices flagged', () => {
    const graph = trapGraph();
    const result = findPath(graph, a, d, {
      eligible: eligibilityFilter({ level: 10, itemsHeld: new Map() }),
    });
    expect(result.status).toBe('unreachable-when-filtered');
    expect(result.steps).toEqual([]);
    expect(result.fallback).toBeDefined();
    // best unfiltered: a -> c (item-restricted shortcut), c -> d (item-restricted gate)
    // — only the gate at the end is what the user can't satisfy.
    const blockedMethods = result.fallback!.blocked.map(
      (i) => result.fallback!.steps[i].method,
    );
    expect(blockedMethods).toContain('item');
  });

  it('eligibility predicate composes meso + level + quest + item correctly', () => {
    const filter = eligibilityFilter({
      mesos: 500,
      level: 20,
      questsCompleted: new Set([7]),
      itemsHeld: new Map([[42, 3]]),
    });

    expect(
      filter({ from: a, to: b, method: 'walk', requirements: [meso(400)] }),
    ).toBe(true);
    expect(
      filter({ from: a, to: b, method: 'walk', requirements: [meso(1000)] }),
    ).toBe(false);
    expect(
      filter({ from: a, to: b, method: 'walk', requirements: [level(25)] }),
    ).toBe(false);
    expect(
      filter({ from: a, to: b, method: 'walk', requirements: [quest(7)] }),
    ).toBe(true);
    expect(
      filter({ from: a, to: b, method: 'walk', requirements: [quest(99)] }),
    ).toBe(false);
    expect(
      filter({
        from: a,
        to: b,
        method: 'walk',
        requirements: [item(42, { consumed: true, quantity: 3 })],
      }),
    ).toBe(true);
    expect(
      filter({
        from: a,
        to: b,
        method: 'walk',
        requirements: [item(42, { consumed: true, quantity: 5 })],
      }),
    ).toBe(false);
  });

  it('eligibility is permissive for fields the user did not declare', () => {
    // declare only level — meso/item/quest requirements pass by default.
    const filter = eligibilityFilter({ level: 10 });
    expect(
      filter({
        from: a,
        to: b,
        method: 'walk',
        requirements: [meso(100), quest(1), item(42, { consumed: false })],
      }),
    ).toBe(true);
  });
});

describe('findPath — return-to-town scrolls', () => {
  // A dungeon (c) whose nearest-town scroll drops you at a hub town (a), plus a
  // slow walk back the long way.
  function scrollGraph() {
    return compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        const na = g.node('a', 'A');
        const nb = g.node('b', 'B');
        g.node('c', 'C', { nearestTown: 'a' });
        na.walk(nb, { seconds: 100 });
        nb.walk(g.ref('c'), { seconds: 100 });
      }),
    );
  }

  it('ignores scroll edges unless the traveller carries scrolls', () => {
    const result = findPath(scrollGraph(), c, a);
    expect(result.status).toBe('found');
    // Long way home: c -> b -> a, two timed walks.
    expect(result.steps.map((s) => `${s.from}->${s.to}`)).toEqual(['c->b', 'b->a']);
    expect(result.totalSeconds).toBe(200);
  });

  it('uses the instant scroll edge to the nearest town when enabled', () => {
    const result = findPath(scrollGraph(), c, a, { nearestTownScroll: true });
    expect(result.status).toBe('found');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].method).toBe('scroll');
    expect(result.steps[0].to).toBe(a);
    expect(result.totalSeconds).toBe(0);
  });

  it('a node without nearestTown produces no scroll edge', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        g.node('a', 'A');
        g.node('b', 'B');
      }),
    );
    // No authored connection and no scroll edge — unreachable even with scrolls.
    expect(findPath(graph, a, b, { nearestTownScroll: true }).status).toBe('unreachable');
  });

  it('rejects a nearestTown that references an undeclared node', () => {
    const source = {
      profileId: 'test',
      nodes: [{ id: 'a', name: 'A', nearestTown: 'ghost' }],
      edges: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hand-written IR
    expect(() => compileGraph(source as any)).toThrow(/nearestTown "ghost"/);
  });
});
