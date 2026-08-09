import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import type { GroupId, NavGraph } from '@scrolled/nav-graph';

import { collapseView, type DisplayNode } from '@/lib/graph/collapseView';
import {
  activeSteps,
  pathEdgeKeys as computePathEdgeKeys,
  pathNodeIds as computePathNodeIds,
} from '@/lib/graph/pathHelpers';
import { nestedLayout } from '@/lib/layout/nestedLayout';
import { useDirections } from '@/stores/useDirections';
import { useEndpoints } from '@/hooks/useEndpoints';

import { AreaNodeView, type AreaHighlight } from './AreaNodeView';
import { RegionNodeView } from './RegionNodeView';
import { RegionContainerView } from './RegionContainerView';
import { TravelEdgeView } from './TravelEdgeView';

const nodeTypes: NodeTypes = {
  area: AreaNodeView,
  region: RegionNodeView,
  'region-container': RegionContainerView,
};
const edgeTypes: EdgeTypes = { travel: TravelEdgeView };

export interface GraphCanvasProps {
  graph: NavGraph;
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner({ graph }: GraphCanvasProps) {
  const result = useDirections((s) => s.result);
  const { fromId, toId } = useEndpoints(graph);
  const { fitView } = useReactFlow();

  // Regions the user has opened by hand. Route regions expand on top of this
  // (see collapseView), so removing one here never hides a node on the route.
  const [manualExpanded, setManualExpanded] = useState<ReadonlySet<GroupId>>(() => new Set());

  const { pathNodes, pathEdges } = useMemo(() => {
    const steps = activeSteps(result);
    return {
      pathNodes: computePathNodeIds(steps),
      pathEdges: computePathEdgeKeys(graph, steps),
    };
  }, [graph, result]);

  const view = useMemo(
    () =>
      collapseView({ graph, manualExpanded, pathNodeIds: pathNodes, pathEdgeKeys: pathEdges }),
    [graph, manualExpanded, pathNodes, pathEdges],
  );

  const layout = useMemo(() => nestedLayout(view.nodes, view.edges), [view]);

  const routeActive = pathNodes.size > 0;

  // Hovering a region at rest lights up just its connections; a computed route
  // takes precedence over hover.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { focusSet, neighborSet } = useMemo(() => {
    if (!hoveredId || routeActive) return { focusSet: null, neighborSet: null };
    const children = view.nodes.filter((n) => n.parentId === hoveredId).map((n) => n.id);
    const focus = new Set(children.length > 0 ? children : [hoveredId]);
    const neighbors = new Set<string>();
    for (const e of view.edges) {
      if (focus.has(e.source)) neighbors.add(e.target);
      if (focus.has(e.target)) neighbors.add(e.source);
    }
    return { focusSet: focus, neighborSet: neighbors };
  }, [hoveredId, routeActive, view.nodes, view.edges]);

  const nodeDimmed = useCallback(
    (id: string, keepOnRoute: boolean): boolean => {
      if (routeActive) return !keepOnRoute;
      if (focusSet) return !(focusSet.has(id) || (neighborSet?.has(id) ?? false));
      return false;
    },
    [routeActive, focusSet, neighborSet],
  );

  const nodes = useMemo<Node[]>(() => {
    // React Flow requires a parent node to precede its children in the array.
    const ordered = [...view.nodes].sort((a, b) => containerFirst(a) - containerFirst(b));
    return ordered.map((n) => {
      const position = layout.positions.get(n.id) ?? { x: 0, y: 0 };
      const size = layout.sizes.get(n.id);

      if (n.kind === 'region-container') {
        return {
          id: n.id,
          type: 'region-container',
          position,
          draggable: false,
          selectable: false,
          style: { width: size?.width, height: size?.height },
          data: { groupId: n.groupId, label: n.label, containsPath: n.containsPath ?? false },
        } satisfies Node;
      }

      if (n.kind === 'region-collapsed') {
        return {
          id: n.id,
          type: 'region',
          position,
          draggable: false,
          data: {
            groupId: n.groupId,
            label: n.label,
            areaCount: n.areaCount ?? 0,
            dimmed: nodeDimmed(n.id, false),
          },
        } satisfies Node;
      }

      const highlight: AreaHighlight =
        n.nodeId === fromId ? 'start' : n.nodeId === toId ? 'end' : n.onPath ? 'path' : null;
      const keepOnRoute = n.onPath || n.nodeId === fromId || n.nodeId === toId;
      const dimmed = nodeDimmed(n.id, keepOnRoute);
      return {
        id: n.id,
        type: 'area',
        position,
        draggable: false,
        ...(n.parentId ? { parentId: n.parentId, extent: 'parent' as const } : {}),
        data: { nodeId: n.nodeId, label: n.label, highlight, dimmed },
      } satisfies Node;
    });
  }, [view.nodes, layout, nodeDimmed, fromId, toId]);

  const edges = useMemo<Edge[]>(
    () =>
      view.edges.map((e) => {
        const opacity = edgeOpacity(e, routeActive, focusSet);
        // Arrowheads only clutter the overview — reserve them for the route,
        // where travel direction actually matters.
        const marker = e.onPath
          ? { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' }
          : undefined;
        return {
          id: e.id,
          type: 'travel',
          source: e.source,
          target: e.target,
          zIndex: e.onPath ? 1 : 0,
          data: {
            method: e.method,
            bidirectional: e.bidirectional,
            onPath: e.onPath,
            count: e.count,
            minor: e.minor,
            opacity,
          },
          markerEnd: marker,
          markerStart: e.onPath && e.bidirectional ? marker : undefined,
        } satisfies Edge;
      }),
    [view.edges, routeActive, focusSet],
  );

  // Re-frame whenever the visible set changes (route computed, region toggled).
  useEffect(() => {
    const id = window.requestAnimationFrame(() => fitView({ duration: 300, padding: 0.2 }));
    return () => window.cancelAnimationFrame(id);
  }, [fitView, view]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const groupId = (node.data as { groupId?: GroupId }).groupId;
    if (!groupId) return;
    if (node.type === 'region') {
      setManualExpanded((prev) => new Set(prev).add(groupId));
    } else if (node.type === 'region-container') {
      setManualExpanded((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
      onNodeMouseLeave={() => setHoveredId(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}

function containerFirst(n: DisplayNode): number {
  return n.kind === 'region-container' ? 0 : 1;
}

// Calm at rest, focused connections lit on hover, route lines full-strength.
function edgeOpacity(
  edge: { source: string; target: string; onPath: boolean },
  routeActive: boolean,
  focusSet: ReadonlySet<string> | null,
): number {
  if (routeActive) return edge.onPath ? 1 : 0.1;
  if (focusSet) return focusSet.has(edge.source) || focusSet.has(edge.target) ? 1 : 0.05;
  return 0.18;
}
