import { describe, expect, it } from 'vitest';
import { compileGraph } from '../../compile/compileGraph';
import { findPath } from '../../path/findPath';
import { asNodeId } from '../../ir/types';
import { starterGraph } from './index';

describe('starter graph', () => {
  const graph = compileGraph(starterGraph);

  it('compiles cleanly', () => {
    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(graph.source.edges.length).toBeGreaterThan(0);
  });

  it('is connected — every node is reachable from the entry hub', () => {
    const root = asNodeId('riverside');
    for (const [id] of graph.nodes) {
      const result = findPath(graph, root, id);
      expect(result.status, `unreachable: ${root} -> ${id}`).toBe('found');
    }
  });

  it('every group referenced by a node is declared', () => {
    const declared = new Set([...graph.groups.keys()]);
    for (const [, node] of graph.nodes) {
      if (node.group) expect(declared.has(node.group)).toBe(true);
    }
  });
});
