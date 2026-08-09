import { describe, expect, it } from 'vitest';
import type { DisplayEdge, DisplayNode } from '@/lib/graph/collapseView';
import { nestedLayout } from './nestedLayout';

const area = (id: string, parentId?: string): DisplayNode => ({
  id,
  kind: 'area',
  label: id,
  nodeId: id as DisplayNode['nodeId'],
  ...(parentId ? { parentId } : {}),
});

const container = (id: string): DisplayNode => ({ id, kind: 'region-container', label: id });
const collapsed = (id: string): DisplayNode => ({ id, kind: 'region-collapsed', label: id, areaCount: 3 });

const edge = (source: string, target: string): DisplayEdge => ({
  id: `${source}~${target}`,
  source,
  target,
  bidirectional: true,
  onPath: false,
  count: 1,
  method: 'walk',
  minor: false,
});

describe('nestedLayout', () => {
  it('sizes a container to hold its children below the header', () => {
    const nodes = [container('region:west'), area('a1', 'region:west'), area('a2', 'region:west')];
    const edges = [edge('a1', 'a2')];
    const { positions, sizes } = nestedLayout(nodes, edges, { areaWidth: 180, areaHeight: 64 });

    const size = sizes.get('region:west');
    expect(size).toBeDefined();
    // Wide enough for two LR-ranked areas, tall enough for the header band.
    expect(size!.width).toBeGreaterThan(180);
    expect(size!.height).toBeGreaterThan(64);

    // Children are positioned relative to the parent, offset past the header.
    for (const id of ['a1', 'a2']) {
      const p = positions.get(id)!;
      expect(p.x).toBeGreaterThanOrEqual(16);
      expect(p.y).toBeGreaterThanOrEqual(30);
    }
  });

  it('lays out top-level nodes with absolute positions', () => {
    const nodes = [container('region:west'), area('a1', 'region:west'), collapsed('region:east'), area('hub')];
    const edges = [edge('a1', 'region:east'), edge('region:east', 'hub')];
    const { positions } = nestedLayout(nodes, edges);

    expect(positions.has('region:west')).toBe(true);
    expect(positions.has('region:east')).toBe(true);
    expect(positions.has('hub')).toBe(true);
    // Distinct ranks under LR layout — not all stacked at the same x.
    const xs = new Set(['region:west', 'region:east', 'hub'].map((id) => positions.get(id)!.x));
    expect(xs.size).toBeGreaterThan(1);
  });
});
