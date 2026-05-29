import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GitBranch } from 'lucide-react';
import { HoverPopover } from '@/components/common/HoverPopover';
import { HoverCardSaveFooter } from '@/components/collections';
import { getDbClient } from '@/db';
import { useShowEntityIds } from '@/stores/showEntityIds';

interface QuestChainLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function QuestChainLink({
  id,
  children,
  className,
  noPreview,
  triggerClassName,
}: QuestChainLinkProps) {
  const link = (
    <Link to={`/quest-chains/${id}`} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<QuestChainHoverCard id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}

function QuestChainHoverCard({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const showIds = useShowEntityIds((s) => s.enabled);
  const chainQ = useQuery({
    queryKey: ['db', 'quest-chain', id],
    queryFn: () => client.getQuestChain(id),
    staleTime: 5 * 60_000,
  });

  if (chainQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!chainQ.data) {
    return <p className="text-muted-foreground text-xs">Chain {id} not found.</p>;
  }
  const c = chainQ.data.chain;
  // First few member names give the reader a feel for what's in the chain
  // without a separate query — `getQuestChain` already joined the names in.
  const preview = chainQ.data.members.slice(0, 3).map((m) => m.questName);

  return (
    <div className="w-72 max-w-[calc(100vw-1rem)] space-y-1.5">
      <div className="flex gap-3">
        <span className="bg-muted text-muted-foreground inline-flex h-16 w-16 shrink-0 items-center justify-center rounded">
          <GitBranch className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <div className="truncate text-sm font-semibold">{c.name}</div>
            {showIds && (
              <div className="text-muted-foreground font-mono text-[10px]">Chain #{id}</div>
            )}
          </div>
          <div className="text-muted-foreground text-[11px]">
            {c.size} quests · {c.maxDepth} stages
            {c.rootCount > 1 ? ` · ${c.rootCount} starts` : ''}
            {c.hasCycles ? ' · contains loop' : ''}
            {c.parent ? ` · ${c.parent}` : ''}
          </div>
          {preview.length > 0 && (
            <p className="text-muted-foreground line-clamp-2 text-xs">{preview.join(' → ')}</p>
          )}
        </div>
      </div>
      <HoverCardSaveFooter entityType="questChain" entityId={id} />
    </div>
  );
}
