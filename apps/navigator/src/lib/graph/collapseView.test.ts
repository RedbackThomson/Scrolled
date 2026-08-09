import { describe, expect, it } from 'vitest';
import {
  asGroupId,
  asNodeId,
  compileGraph,
  defineGraph,
  type GroupId,
  type NavGraph,
  type NodeId,
} from '@scrolled/nav-graph';
import { collapseView } from './collapseView';

// west: a1-a2-a3 (walk chain); east: b1, b2; ungrouped hub.
// Two cross-region portals (a1->b1, a3->b2) both collapse to one west~east line.
// A minor a1->hub portal is hidden unless it's on the route.
function fixture(): NavGraph {
  const source = defineGraph({ profileId: 'test' }, (g) => {
    g.region('west', 'West', (r) => {
      const a1 = r.node('a1', 'A1');
      const a2 = r.node('a2', 'A2');
      const a3 = r.node('a3', 'A3');
      a1.walk(a2, { seconds: 60 });
      a2.walk(a3, { seconds: 60 });
    });
    g.region('east', 'East', (r) => {
      r.node('b1', 'B1');
      r.node('b2', 'B2');
    });
    g.node('hub', 'Hub');
    g.ref('a1').portalTo(g.ref('b1'));
    g.ref('a3').portalTo(g.ref('b2'));
    g.ref('b1').walk(g.ref('hub'), { seconds: 60 });
    g.ref('a1').portalTo(g.ref('hub'), { minor: true });
  });
  return compileGraph(source);
}

const NONE: ReadonlySet<never> = new Set();
const node = (id: string): NodeId => asNodeId(id);
const group = (id: string): GroupId => asGroupId(id);

function edgeKey(graph: NavGraph, from: string, to: string): string {
  const i = graph.source.edges.findIndex((e) => e.from === from && e.to === to);
  return `${from}->${to}#${i}`;
}

describe('collapseView', () => {
  it('collapses every region to one node in the default view', () => {
    const graph = fixture();
    const view = collapseView({
      graph,
      manualExpanded: NONE,
      pathNodeIds: NONE,
      pathEdgeKeys: NONE,
    });

    const west = view.nodes.find((n) => n.id === 'region:west');
    expect(west?.kind).toBe('region-collapsed');
    expect(west?.areaCount).toBe(3);
    expect(view.nodes.find((n) => n.id === 'region:east')?.kind).toBe('region-collapsed');
    expect(view.nodes.find((n) => n.id === 'hub')?.kind).toBe('area');
    expect(view.nodes.some((n) => n.kind === 'area' && n.parentId)).toBe(false);
  });

  it('aggregates parallel cross-region edges into a single line', () => {
    const graph = fixture();
    const view = collapseView({
      graph,
      manualExpanded: NONE,
      pathNodeIds: NONE,
      pathEdgeKeys: NONE,
    });

    const crossEdges = view.edges.filter(
      (e) =>
        (e.source === 'region:west' && e.target === 'region:east') ||
        (e.source === 'region:east' && e.target === 'region:west'),
    );
    expect(crossEdges).toHaveLength(1);
    expect(crossEdges[0].count).toBe(2);
  });

  it('drops edges internal to a collapsed region and hides minor edges', () => {
    const graph = fixture();
    const view = collapseView({
      graph,
      manualExpanded: NONE,
      pathNodeIds: NONE,
      pathEdgeKeys: NONE,
    });

    // a1-a2 and a2-a3 are internal to west; a1-hub is minor and off-route.
    expect(view.edges.some((e) => e.minor)).toBe(false);
    // Remaining: west~east (aggregated) and east~hub.
    expect(view.edges).toHaveLength(2);
    expect(
      view.edges.some(
        (e) =>
          (e.source === 'region:east' && e.target === 'hub') ||
          (e.source === 'hub' && e.target === 'region:east'),
      ),
    ).toBe(true);
  });

  it('shows all areas when a region is manually expanded', () => {
    const graph = fixture();
    const view = collapseView({
      graph,
      manualExpanded: new Set([group('west')]),
      pathNodeIds: NONE,
      pathEdgeKeys: NONE,
    });

    expect(view.nodes.find((n) => n.id === 'region:west')?.kind).toBe('region-container');
    const children = view.nodes.filter((n) => n.parentId === 'region:west');
    expect(children.map((c) => c.id).sort()).toEqual(['a1', 'a2', 'a3']);
    // Internal walk edges now render between the children.
    expect(view.edges.some((e) => e.source === 'a1' && e.target === 'a2')).toBe(true);
  });

  it('expands a route region to only its route areas', () => {
    const graph = fixture();
    const view = collapseView({
      graph,
      manualExpanded: NONE,
      pathNodeIds: new Set([node('a1'), node('hub')]),
      pathEdgeKeys: new Set([edgeKey(graph, 'a1', 'hub')]),
    });

    // west auto-expands, but only its route area (a1) is shown.
    expect(view.nodes.find((n) => n.id === 'region:west')?.kind).toBe('region-container');
    const westChildren = view.nodes.filter((n) => n.parentId === 'region:west');
    expect(westChildren.map((c) => c.id)).toEqual(['a1']);
    // east has no route node, so it stays collapsed.
    expect(view.nodes.find((n) => n.id === 'region:east')?.kind).toBe('region-collapsed');
  });

  it('surfaces a minor edge when it lies on the route', () => {
    const graph = fixture();
    const view = collapseView({
      graph,
      manualExpanded: NONE,
      pathNodeIds: new Set([node('a1'), node('hub')]),
      pathEdgeKeys: new Set([edgeKey(graph, 'a1', 'hub')]),
    });

    const minorEdge = view.edges.find(
      (e) =>
        (e.source === 'a1' && e.target === 'hub') || (e.source === 'hub' && e.target === 'a1'),
    );
    expect(minorEdge).toBeDefined();
    expect(minorEdge?.minor).toBe(true);
    expect(minorEdge?.onPath).toBe(true);
  });
});
