import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Crown, Skull } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { HoverPopover } from '@/components/HoverPopover';
import { HoverCardSaveFooter } from '@/components/collections';
import { getDbClient } from '@/db';

interface MobLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function MobLink({ id, children, className, noPreview, triggerClassName }: MobLinkProps) {
  const link = (
    <Link to={`/mobs/${id}`} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<MobHoverCard id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}

export function MobHoverCard({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const mobQ = useQuery({
    queryKey: ['db', 'mob', id],
    queryFn: () => client.getMob(id),
    staleTime: 5 * 60_000,
  });

  if (mobQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!mobQ.data) {
    return <p className="text-muted-foreground text-xs">Mob {id} not found.</p>;
  }
  const m = mobQ.data;

  return (
    <div className="w-72 space-y-1.5">
      <div className="flex gap-3">
        <EntityIcon entity="mob" id={id} size={64} placeholder={Skull} alt={m.name} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              to={`/mobs/${id}`}
              className="hover:text-primary truncate text-sm font-semibold hover:underline"
            >
              {m.name}
            </Link>
            {m.isBoss && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                <Crown className="h-3 w-3" />
                Boss
              </span>
            )}
          </div>
          <div className="text-muted-foreground font-mono text-[10px]">Mob #{id}</div>
          <dl className="text-muted-foreground grid grid-cols-3 gap-1 text-[11px]">
            <div>
              <dt className="uppercase tracking-wide">Lv</dt>
              <dd className="text-foreground font-mono">{m.level ?? '—'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">HP</dt>
              <dd className="text-foreground font-mono">{m.hp?.toLocaleString() ?? '—'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">EXP</dt>
              <dd className="text-foreground font-mono">{m.exp?.toLocaleString() ?? '—'}</dd>
            </div>
          </dl>
          {m.elementAttack && (
            <div className="text-muted-foreground text-[11px]">Element: {m.elementAttack}</div>
          )}
        </div>
      </div>
      <HoverCardSaveFooter entityType="mob" entityId={id} />
    </div>
  );
}
