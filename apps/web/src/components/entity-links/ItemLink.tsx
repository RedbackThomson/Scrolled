import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ItemIcon } from '@/components/ItemIcon';
import { HoverPopover } from '@/components/HoverPopover';
import { HoverCardSaveFooter } from '@/components/collections';
import { getDbClient } from '@/db';

interface ItemLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
}

export function ItemLink({ id, children, className, noPreview }: ItemLinkProps) {
  const link = (
    <Link to={`/items/${id}`} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return <HoverPopover content={<ItemHoverCard id={id} />}>{link}</HoverPopover>;
}

function ItemHoverCard({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const itemQ = useQuery({
    queryKey: ['db', 'item', id],
    queryFn: () => client.getItem(id),
    staleTime: 5 * 60_000,
  });

  if (itemQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!itemQ.data) {
    return <p className="text-muted-foreground text-xs">Item {id} not found.</p>;
  }
  const item = itemQ.data;

  return (
    <div className="w-72 space-y-1.5">
      <div className="flex gap-3">
        <ItemIcon entity="item" id={id} size={64} alt={item.name} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <div className="truncate text-sm font-semibold">{item.name}</div>
            <div className="text-muted-foreground font-mono text-[10px]">Item #{id}</div>
          </div>
          {(item.category || item.subcategory) && (
            <div className="text-muted-foreground text-[11px] capitalize">
              {[item.category, item.subcategory].filter(Boolean).join(' · ')}
            </div>
          )}
          {item.description && (
            <p className="text-muted-foreground line-clamp-3 text-xs">{item.description}</p>
          )}
          {(item.requiredLevel !== null || item.price !== null) && (
            <div className="text-muted-foreground text-[11px]">
              {item.requiredLevel !== null && <>Req Lv {item.requiredLevel}</>}
              {item.requiredLevel !== null && item.price !== null && ' · '}
              {item.price !== null && <>{item.price.toLocaleString()} mesos</>}
            </div>
          )}
        </div>
      </div>
      <HoverCardSaveFooter entityType="item" entityId={id} />
    </div>
  );
}
