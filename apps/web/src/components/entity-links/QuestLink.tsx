import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { HoverPopover } from '@/components/HoverPopover';
import { HoverCardSaveFooter } from '@/components/collections';
import { getDbClient } from '@/db';

interface QuestLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function QuestLink({ id, children, className, noPreview, triggerClassName }: QuestLinkProps) {
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
  const questQ = useQuery({
    queryKey: ['db', 'quest', id],
    queryFn: () => client.getQuest(id),
    staleTime: 5 * 60_000,
  });

  if (questQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!questQ.data) {
    return <p className="text-muted-foreground text-xs">Quest {id} not found.</p>;
  }
  const q = questQ.data;

  return (
    <div className="w-72 space-y-1.5">
      <div className="flex gap-3">
        <span className="bg-muted text-muted-foreground inline-flex h-16 w-16 shrink-0 items-center justify-center rounded">
          <ScrollText className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <div className="truncate text-sm font-semibold">{q.name}</div>
            <div className="text-muted-foreground font-mono text-[10px]">Quest #{id}</div>
          </div>
          {(q.parent || q.requiredLevel !== null) && (
            <div className="text-muted-foreground text-[11px]">
              {q.parent && <>{q.parent}</>}
              {q.parent && q.requiredLevel !== null && ' · '}
              {q.requiredLevel !== null && <>Lv {q.requiredLevel}+</>}
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
