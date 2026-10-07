import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@scrolled/design';
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
  start: 'ring-[3px] ring-emerald-500 shadow-[0_0_0_8px_rgb(16_185_129/0.22)]',
  end: 'ring-[3px] ring-sky-500',
  path: 'ring-[3px] ring-primary',
};

export function AreaNodeView({ data }: NodeProps<AreaFlowNode>) {
  return (
    <div
      className={cn(
        'border-border bg-card text-card-foreground shadow-rim min-w-[140px] rounded-[14px] border-2 px-3.5 py-2 text-[13px] transition-[box-shadow,opacity] duration-300',
        data.highlight && HIGHLIGHT_RING[data.highlight],
        data.dimmed && 'opacity-75',
      )}
    >
      <div className="font-bold leading-tight">{data.label}</div>
      {data.groupName ? (
        <div className="text-muted-foreground mt-0.5 text-[11.5px] font-semibold">
          {data.groupName}
        </div>
      ) : null}
      <Handle
        type="target"
        position={Position.Top}
        className="!size-0 !min-h-0 !min-w-0 !border-0 opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-0 !min-h-0 !min-w-0 !border-0 opacity-0"
      />
    </div>
  );
}
