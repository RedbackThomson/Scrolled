import { describe, expect, it } from 'vitest';
import { compileGraph } from '../compile/compileGraph';
import { defineGraph } from '../dsl/builder';
import { item, level, meso, quest } from '../dsl/requirements';
import { asNodeId } from '../ir/types';
import { eligibilityFilter } from './eligibility';
import { findPath } from './findPath';

const a = asNodeId('a');
const b = asNodeId('b');
const c = asNodeId('c');
const d = asNodeId('d');

describe('findPath — BFS', () => {
  it('returns an empty step list when from === to', () => {
    const graph = compileGraph(
      defineGraph({ profileId: 'test' }, (g) => {
        g.node('a', 'A');
      }),
    );
    expect(findPath(graph, a, a)).toEqual({ status: 'found', steps: [] });
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
    expect(findPath(graph, a, b)).toEqual({ status: 'unreachable', steps: [] });
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
