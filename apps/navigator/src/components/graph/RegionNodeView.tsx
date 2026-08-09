import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@scrolled/ui';
import type { GroupId } from '@scrolled/nav-graph';

export interface RegionNodeData extends Record<string, unknown> {
  groupId: GroupId;
  label: string;
  areaCount: number;
  dimmed?: boolean;
}

export type RegionFlowNode = Node<RegionNodeData, 'region'>;

// A whole region collapsed to one node. The offset backing card reads as a
// stack — "there's more inside" — and the chevron signals it opens on click.
export function RegionNodeView({ data }: NodeProps<RegionFlowNode>) {
  return (
    <div className={cn('relative', data.dimmed && 'opacity-40')}>
      <div className="border-border bg-card absolute -right-1.5 -top-1.5 h-full w-full rounded-md border" />
      <div className="border-border bg-card text-card-foreground relative flex min-w-[160px] items-center gap-2 rounded-md border px-3 py-2 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-tight">{data.label}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {data.areaCount} {data.areaCount === 1 ? 'area' : 'areas'}
          </div>
        </div>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </div>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !border-background" />
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !border-background" />
    </div>
  );
}
