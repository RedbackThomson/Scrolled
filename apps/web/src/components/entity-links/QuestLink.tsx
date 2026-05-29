import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, ScrollText } from 'lucide-react';
import { HoverPopover } from '@/components/common/HoverPopover';
import { HoverCardSaveFooter } from '@/components/collections';
import { getDbClient } from '@/db';
import { useFeatures } from '@/hooks/useFeatures';
import { useShowEntityIds } from '@/stores/showEntityIds';

interface QuestLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function QuestLink({
  id,
  children,
  className,
  noPreview,
  triggerClassName,
}: QuestLinkProps) {
  const link = (
    <Link to={`/quests/${id}`} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<QuestHoverCard id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}

function QuestHoverCard({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const showIds = useShowEntityIds((s) => s.enabled);
  const features = useFeatures();
  const questQ = useQuery({
    queryKey: ['db', 'quest', id],
    queryFn: () => client.getQuest(id),
    staleTime: 5 * 60_000,
  });
  // Same gating as QuestDetail: only fire when chains exist in the
  // library, and reuse the same query key so the network hit is shared
  // with anything else on the page that already asked.
  const chainQ = useQuery({
    queryKey: ['db', 'quest', id, 'chain'],
    queryFn: () => client.getChainForQuest(id),
    enabled: features.hasQuestChains,
    staleTime: 5 * 60_000,
  });

  if (questQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!questQ.data) {
    return <p className="text-muted-foreground text-xs">Quest {id} not found.</p>;
  }
  const q = questQ.data;
  const chain = chainQ.data;

  return (
    <div className="w-72 max-w-[calc(100vw-1rem)] space-y-1.5">
      <div className="flex gap-3">
        <span className="bg-muted text-muted-foreground inline-flex h-16 w-16 shrink-0 items-center justify-center rounded">
          <ScrollText className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <div className="truncate text-sm font-semibold">{q.name}</div>
            {showIds && (
              <div className="text-muted-foreground font-mono text-[10px]">Quest #{id}</div>
            )}
          </div>
          {(q.parent || q.requiredLevel !== null) && (
            <div className="text-muted-foreground text-[11px]">
              {q.parent && <>{q.parent}</>}
              {q.parent && q.requiredLevel !== null && ' · '}
              {q.requiredLevel !== null && <>Lv {q.requiredLevel}+</>}
            </div>
          )}
          {chain && (
            <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <GitBranch className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">
                Part of {chain.name} ({chain.size} quests)
              </span>
            </div>
          )}
          {q.description && (
            <p className="text-muted-foreground line-clamp-3 text-xs">{q.description}</p>
          )}
        </div>
      </div>
      <HoverCardSaveFooter entityType="quest" entityId={id} />
    </div>
  );
}
