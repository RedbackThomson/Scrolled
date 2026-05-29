import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Crown, Skull } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { HoverPopover } from '@/components/common/HoverPopover';
import { HoverCardSaveFooter } from '@/components/collections';
import { getDbClient } from '@/db';
import { useShowEntityIds } from '@/stores/showEntityIds';
import {
  ELEMENT_GROUP_LABELS,
  ELEMENT_STATUS_CLASSES,
  elementsByStatus,
} from '@/domain/mobElements';

const HOVER_CARD_STATUSES = ['immune', 'resistant', 'weak'] as const;

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
  const showIds = useShowEntityIds((s) => s.enabled);
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
  const elementGroups = HOVER_CARD_STATUSES.map((status) => ({
    status,
    names: elementsByStatus(m.elementAttack, status),
  })).filter((g) => g.names.length > 0);

  return (
    <div className="w-72 max-w-[calc(100vw-1rem)] space-y-1.5">
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
          {showIds && (
            <div className="text-muted-foreground font-mono text-[10px]">Mob #{id}</div>
          )}
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
        </div>
      </div>
      {elementGroups.length > 0 && (
        <dl className="space-y-0.5 text-[11px]">
          {elementGroups.map(({ status, names }) => (
            <div key={status} className="flex gap-2">
              <dt className="text-muted-foreground shrink-0">{ELEMENT_GROUP_LABELS[status]}</dt>
              <dd className={ELEMENT_STATUS_CLASSES[status]}>{names.join(', ')}</dd>
            </div>
          ))}
        </dl>
      )}
      <HoverCardSaveFooter entityType="mob" entityId={id} />
    </div>
  );
}
