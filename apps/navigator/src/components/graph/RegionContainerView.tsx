import { type Node, type NodeProps } from '@xyflow/react';
import { ChevronsDownUp } from 'lucide-react';
import { cn } from '@scrolled/ui';
import type { GroupId } from '@scrolled/nav-graph';

export interface RegionContainerData extends Record<string, unknown> {
  groupId: GroupId;
  label: string;
  containsPath?: boolean;
}

export type RegionContainerNode = Node<RegionContainerData, 'region-container'>;

// The expanded form of a region: a dashed, tinted box that frames the areas
// inside it (rendered as React Flow child nodes on top of this one). The header
// names the region and the chevron collapses it back to a single node.
export function RegionContainerView({ data }: NodeProps<RegionContainerNode>) {
  return (
    <div
      className={cn(
        'size-full rounded-xl border border-dashed',
        data.containsPath
          ? 'border-primary/60 bg-primary/[0.06]'
          : 'border-border bg-muted/30',
      )}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 px-3 pt-2 text-xs font-medium">
        <span className="truncate">{data.label}</span>
        <ChevronsDownUp className="size-3.5 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
