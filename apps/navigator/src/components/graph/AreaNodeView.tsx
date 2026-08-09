import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@scrolled/ui';
import type { NodeId } from '@scrolled/nav-graph';

export type AreaHighlight = 'start' | 'end' | 'path' | null;

export interface AreaNodeData extends Record<string, unknown> {
  nodeId: NodeId;
  label: string;
  groupName?: string;
  highlight?: AreaHighlight;
  dimmed?: boolean;
}

export type AreaFlowNode = Node<AreaNodeData, 'area'>;

const HIGHLIGHT_RING: Record<NonNullable<AreaHighlight>, string> = {
  start: 'ring-2 ring-emerald-500',
  end: 'ring-2 ring-sky-500',
  path: 'ring-2 ring-primary/60',
};

export function AreaNodeView({ data }: NodeProps<AreaFlowNode>) {
  const ringClass = data.highlight ? HIGHLIGHT_RING[data.highlight] : '';
  return (
    <div
      className={cn(
        'border-border bg-card text-card-foreground min-w-[140px] rounded-md border px-3 py-2 text-sm shadow-sm transition-[box-shadow,opacity]',
        ringClass,
        data.dimmed && 'opacity-40',
      )}
    >
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
