import { useMemo } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import type { NavGraph, NodeId, PathResult, TravelEdge } from '@scrolled/nav-graph';

import { dagreLayout } from '@/lib/layout/dagreLayout';
import { useDirections } from '@/stores/useDirections';
import { useEndpoints } from '@/hooks/useEndpoints';

import {
  AreaNodeView,
  type AreaFlowNode,
  type AreaHighlight,
} from './AreaNodeView';
import { TravelEdgeView, type TravelFlowEdge } from './TravelEdgeView';

const nodeTypes: NodeTypes = { area: AreaNodeView };
const edgeTypes: EdgeTypes = { travel: TravelEdgeView };

export interface GraphCanvasProps {
  graph: NavGraph;
}

export function GraphCanvas({ graph }: GraphCanvasProps) {
  const result = useDirections((s) => s.result);
  const { fromId, toId } = useEndpoints(graph);

  // Layout (expensive) memoizes on the graph alone — endpoint/highlight changes
  // shouldn't re-run dagre.
  const layout = useMemo(() => {
    const nodeWidth = 180;
    const nodeHeight = 64;
    const positions = dagreLayout(graph, { nodeWidth, nodeHeight });
    return { positions, nodeWidth, nodeHeight };
  }, [graph]);

  const { nodes, edges } = useMemo(() => {
    const pathSteps = activeSteps(result);
    const pathEdges = pathEdgeIds(graph, pathSteps);
    const pathNodes = pathNodeIds(pathSteps);

    const flowNodes: AreaFlowNode[] = [...graph.nodes.values()].map((node) => {
      const position = layout.positions.get(node.id) ?? { x: 0, y: 0 };
      const groupName = node.group ? graph.groups.get(node.group)?.name : undefined;
      return {
        id: node.id,
        type: 'area',
        position,
        width: layout.nodeWidth,
        height: layout.nodeHeight,
        data: {
          nodeId: node.id,
          label: node.name,
          groupName,
          highlight: nodeHighlight(node.id, fromId, toId, pathNodes),
        },
      };
    });

    const flowEdges: TravelFlowEdge[] = graph.source.edges.map((edge, index) => {
      const id = `${edge.from}->${edge.to}#${index}`;
      const onPath = pathEdges.has(id);
      const stroke = onPath ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
      return {
        id,
        type: 'travel',
        source: edge.from,
        target: edge.to,
        selected: onPath,
        data: { method: edge.method, bidirectional: edge.bidirectional ?? false },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
        markerStart: edge.bidirectional
          ? { type: MarkerType.ArrowClosed, color: stroke }
          : undefined,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph, layout, result, fromId, toId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}

function activeSteps(result: PathResult | null): readonly TravelEdge[] {
  if (!result) return [];
  if (result.status === 'found') return result.steps;
  if (result.status === 'unreachable-when-filtered') return result.fallback?.steps ?? [];
  return [];
}

// A path step may traverse a bidirectional source edge in either direction; we
// want the single rendered edge highlighted regardless of direction.
function pathEdgeIds(graph: NavGraph, steps: readonly TravelEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const step of steps) {
    for (let i = 0; i < graph.source.edges.length; i++) {
      const src = graph.source.edges[i];
      if (src.method !== step.method) continue;
      const sameDir = src.from === step.from && src.to === step.to;
      const reverseBi = src.bidirectional && src.from === step.to && src.to === step.from;
      if (sameDir || reverseBi) {
        ids.add(`${src.from}->${src.to}#${i}`);
        break;
      }
    }
  }
  return ids;
}

function pathNodeIds(steps: readonly TravelEdge[]): Set<NodeId> {
  const ids = new Set<NodeId>();
  for (const step of steps) {
    ids.add(step.from);
    ids.add(step.to);
  }
  return ids;
}

function nodeHighlight(
  id: NodeId,
  fromId: string | null,
  toId: string | null,
  pathNodes: Set<NodeId>,
): AreaHighlight {
  if (fromId === id) return 'start';
  if (toId === id) return 'end';
  if (pathNodes.has(id)) return 'path';
  return null;
}
