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
            dimmed: routeActive,
          },
        } satisfies Node;
      }

      const highlight: AreaHighlight =
        n.nodeId === fromId ? 'start' : n.nodeId === toId ? 'end' : n.onPath ? 'path' : null;
      const dimmed = routeActive && !n.onPath && n.nodeId !== fromId && n.nodeId !== toId;
      return {
        id: n.id,
        type: 'area',
        position,
        draggable: false,
        ...(n.parentId ? { parentId: n.parentId, extent: 'parent' as const } : {}),
        data: { nodeId: n.nodeId, label: n.label, highlight, dimmed },
      } satisfies Node;
    });
  }, [view.nodes, layout, routeActive, fromId, toId]);

  const edges = useMemo<Edge[]>(
    () =>
      view.edges.map((e) => {
        const stroke = e.onPath ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
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
            dimmed: routeActive && !e.onPath,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
          markerStart: e.bidirectional
            ? { type: MarkerType.ArrowClosed, color: stroke }
            : undefined,
        } satisfies Edge;
      }),
    [view.edges, routeActive],
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
