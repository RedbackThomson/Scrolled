import { AlertTriangle, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
 */
export function QuestChainGraphNode({ node, showId }: Props) {
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
        'border-border bg-card text-card-foreground hover:bg-accent flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs shadow-sm transition-colors',
        node.isRoot && 'border-emerald-500/60 ring-2 ring-emerald-500/30',
        node.inCycle && 'border-amber-500/70 ring-2 ring-amber-500/30',
        !node.isCritical && 'border-dashed opacity-60',
      )}
      title={
        node.isCritical
          ? undefined
          : 'Optional — skippable when racing toward the final quest'
      }
    >
      {node.inCycle ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      ) : (
        <ScrollText className="text-muted-foreground h-4 w-4 shrink-0" />
      )}
      <span
        className={cn('min-w-0 flex-1 truncate font-medium', !node.isCritical && 'italic')}
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
