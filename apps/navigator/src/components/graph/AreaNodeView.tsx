import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { NodeId } from '@scrolled/nav-graph';

export interface AreaNodeData extends Record<string, unknown> {
  nodeId: NodeId;
  label: string;
  groupName?: string;
}

export type AreaFlowNode = Node<AreaNodeData, 'area'>;

export function AreaNodeView({ data }: NodeProps<AreaFlowNode>) {
  return (
    <div className="border-border bg-card text-card-foreground min-w-[140px] rounded-md border px-3 py-2 text-sm shadow-sm">
      <div className="font-medium leading-tight">{data.label}</div>
      {data.groupName ? (
        <div className="text-muted-foreground mt-0.5 text-xs">{data.groupName}</div>
      ) : null}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !border-background"
      />
    </div>
  );
}
