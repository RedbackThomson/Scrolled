import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@scrolled/design';
import type { GroupId } from '@scrolled/nav-graph';
import { regionHue } from './regionHue';

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
  const hue = regionHue(data.groupId);
  return (
    <div className={cn('relative transition-opacity duration-300', data.dimmed && 'opacity-75')}>
      <div
        className="absolute -right-1.5 -top-1.5 h-full w-full rounded-[14px] border-2 border-dashed"
        style={{
          background: `oklch(0.72 0.12 ${hue} / 0.12)`,
          borderColor: `oklch(0.66 0.14 ${hue} / 0.45)`,
        }}
      />
      <div className="border-border bg-card text-card-foreground shadow-rim relative flex min-w-[160px] items-center gap-2 rounded-[14px] border-2 px-3.5 py-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: `oklch(0.66 0.14 ${hue})` }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-sm font-semibold leading-tight">
            {data.label}
          </div>
          <div className="text-muted-foreground mt-0.5 text-[11.5px] font-semibold">
            {data.areaCount} {data.areaCount === 1 ? 'area' : 'areas'}
          </div>
        </div>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </div>
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
