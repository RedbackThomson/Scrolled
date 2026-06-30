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

import { useNavGraph } from '@/hooks/useNavGraph';
import { dagreLayout } from '@/lib/layout/dagreLayout';

import { AreaNodeView, type AreaFlowNode } from './AreaNodeView';
import { TravelEdgeView, type TravelFlowEdge } from './TravelEdgeView';

const nodeTypes: NodeTypes = { area: AreaNodeView };
const edgeTypes: EdgeTypes = { travel: TravelEdgeView };

export function GraphCanvas() {
  const graph = useNavGraph();

  const { nodes, edges } = useMemo(() => {
    const nodeWidth = 180;
    const nodeHeight = 64;
    const positions = dagreLayout(graph, { nodeWidth, nodeHeight });

    // width/height aren't strictly required for the main canvas (React Flow
    // measures the rendered DOM) but the MiniMap reads them directly and skips
    // any node missing them — without these, the minimap would show no nodes.
    const flowNodes: AreaFlowNode[] = [...graph.nodes.values()].map((node) => {
      const position = positions.get(node.id) ?? { x: 0, y: 0 };
      const groupName = node.group ? graph.groups.get(node.group)?.name : undefined;
      return {
        id: node.id,
        type: 'area',
        position,
        width: nodeWidth,
        height: nodeHeight,
        data: { nodeId: node.id, label: node.name, groupName },
      };
    });

    const flowEdges: TravelFlowEdge[] = graph.source.edges.map((edge, index) => ({
      id: `${edge.from}->${edge.to}#${index}`,
      type: 'travel',
      source: edge.from,
      target: edge.to,
      data: { method: edge.method, bidirectional: edge.bidirectional ?? false },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--muted-foreground))' },
      markerStart: edge.bidirectional
        ? { type: MarkerType.ArrowClosed, color: 'hsl(var(--muted-foreground))' }
        : undefined,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph]);

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
