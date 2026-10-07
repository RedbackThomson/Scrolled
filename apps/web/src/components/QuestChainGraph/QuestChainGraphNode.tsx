import { AlertTriangle, ExternalLink, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, ENTITY_HUES } from '@scrolled/design';
import type { DagreNode } from './useDagreLayout';

interface Props {
  node: DagreNode;
  showId: boolean;
}

/**
 * One quest card in the chain graph. Positioned absolutely by the canvas;
 * we only handle the visual + the click-through. The link uses `noPreview`
 * implicitly by being a plain `<Link>` — the hover card would compete with
 * the user's pan gesture inside the viewer.
 *
 * External (ghost) nodes represent a quest in another chain that's
 * connected by a cross-chain prereq edge. They render with a heavier
 * dashed border and reduced opacity so the focal chain still reads as
 * the primary layer.
 */
export function QuestChainGraphNode({ node, showId }: Props) {
  const tooltip = node.isExternal
    ? 'External quest — belongs to another chain'
    : node.isCritical
      ? undefined
      : 'Optional — skippable when racing toward the final quest';
  const Icon = node.isExternal ? ExternalLink : node.inCycle ? AlertTriangle : ScrollText;
  const hue = node.inCycle ? 70 : ENTITY_HUES.quest;
  return (
    <Link
      to={`/quests/${node.questId}`}
      style={{
        position: 'absolute',
        left: node.x - node.width / 2,
        top: node.y - node.height / 2,
        width: node.width,
        height: node.height,
      }}
      className={cn(
        'bg-card text-card-foreground ease-spring focus-visible:ring-primary/40 flex items-center gap-2 rounded-[14px] border-2 py-1 pl-1.5 pr-2.5 text-[12.5px] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4',
        'border-border shadow-rim',
        node.isRoot && 'border-emerald-500 ring-[3px] ring-emerald-500/25',
        node.inCycle && 'border-amber-500 ring-[3px] ring-amber-500/25',
        !node.isCritical && !node.isExternal && 'border-dashed opacity-70 shadow-none',
        node.isExternal && 'border-foreground/30 bg-muted border-dotted opacity-[.55] shadow-none',
      )}
      title={tooltip}
    >
      <span
        aria-hidden
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px]"
        style={{
          background: `oklch(0.72 0.12 ${hue} / .2)`,
          color: `oklch(var(--chip-fg-l) 0.14 ${hue})`,
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-semibold',
          (!node.isCritical || node.isExternal) && 'italic',
        )}
      >
        {node.name}
      </span>
      {showId && (
        <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
          {node.questId}
        </span>
      )}
    </Link>
  );
}
