import { type Node, type NodeProps } from '@xyflow/react';
import { ChevronsDownUp } from 'lucide-react';
import type { GroupId } from '@scrolled/nav-graph';
import { regionHue } from './regionHue';

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
  const hue = regionHue(data.groupId);
  return (
    <div
      className="size-full rounded-[28px] border-2 border-dashed"
      style={{
        background: `oklch(0.72 0.12 ${hue} / 0.12)`,
        borderColor: data.containsPath ? 'var(--accent)' : `oklch(0.66 0.14 ${hue} / 0.45)`,
      }}
    >
      <div
        className="font-display flex items-center gap-1.5 px-4 pt-2 text-sm font-semibold"
        style={{ color: `oklch(var(--chip-fg-l) 0.14 ${hue})` }}
      >
        <span className="truncate">{data.label}</span>
        <ChevronsDownUp className="size-3.5 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
