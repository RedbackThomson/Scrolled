import { describe, expect, it } from 'vitest';
import { defineGraph } from '../dsl/builder';
import { compileGraph } from './compileGraph';
import { asNodeId } from '../ir/types';
import type { NavGraphSource } from '../ir/types';

describe('compileGraph', () => {
  it('freezes nodes and adjacency from a DSL-built source', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.walk(b);
    });

    const graph = compileGraph(source);
    expect(graph.nodes.get(asNodeId('a'))?.name).toBe('Alpha');
    expect(graph.adjacency.get(asNodeId('a'))).toHaveLength(1);
    expect(graph.adjacency.get(asNodeId('b'))).toHaveLength(1);
  });

  it('expands bidirectional edges into both directions, keeping the flag', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.walk(b); // bidirectional default
    });

    const graph = compileGraph(source);
    const forward = graph.adjacency.get(asNodeId('a'))?.[0];
    const reverse = graph.adjacency.get(asNodeId('b'))?.[0];
    expect(forward).toMatchObject({ from: 'a', to: 'b', bidirectional: true });
    expect(reverse).toMatchObject({ from: 'b', to: 'a', bidirectional: true });
  });

  it('directed edges produce a single adjacency entry on the source side', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      const a = g.node('a', 'Alpha');
      const b = g.node('b', 'Beta');
      a.npcTo(b);
    });

    const graph = compileGraph(source);
    expect(graph.adjacency.get(asNodeId('a'))).toHaveLength(1);
    expect(graph.adjacency.get(asNodeId('b'))).toHaveLength(0);
  });

  it('rejects a hand-written source with duplicate node ids', () => {
    const source: NavGraphSource = {
      profileId: 'test',
      nodes: [
        { id: asNodeId('a'), name: 'A1' },
        { id: asNodeId('a'), name: 'A2' },
      ],
      edges: [],
    };
    expect(() => compileGraph(source)).toThrow(/Duplicate node id/);
  });

  it('rejects edges with undeclared endpoints', () => {
    const source: NavGraphSource = {
      profileId: 'test',
      nodes: [{ id: asNodeId('a'), name: 'A' }],
      edges: [{ from: asNodeId('a'), to: asNodeId('phantom'), method: 'walk' }],
    };
    expect(() => compileGraph(source)).toThrow(/undeclared nodes.*phantom/);
  });

  it('rejects self-loops', () => {
    const source: NavGraphSource = {
      profileId: 'test',
      nodes: [{ id: asNodeId('a'), name: 'A' }],
      edges: [{ from: asNodeId('a'), to: asNodeId('a'), method: 'walk' }],
    };
    expect(() => compileGraph(source)).toThrow(/Self-loop/);
  });

  it('rejects a node referencing an unknown group', () => {
    const source: NavGraphSource = {
      profileId: 'test',
      nodes: [{ id: asNodeId('a'), name: 'A', group: 'ghost' as never }],
      edges: [],
    };
    expect(() => compileGraph(source)).toThrow(/unknown group "ghost"/);
  });

  it('rejects a NodeId that is not kebab-case', () => {
    const source: NavGraphSource = {
      profileId: 'test',
      nodes: [{ id: asNodeId('Bad_Id'), name: 'X' }],
      edges: [],
    };
    expect(() => compileGraph(source)).toThrow();
  });
});
