import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Map as MapIcon } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { HoverPopover } from '@/components/HoverPopover';
import { HoverCardSaveFooter } from '@/components/collections';
import { getDbClient } from '@/db';

interface MapLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
}

export function MapLink({ id, children, className, noPreview }: MapLinkProps) {
  const link = (
    <Link to={`/maps/${id}`} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return <HoverPopover content={<MapHoverCard id={id} />}>{link}</HoverPopover>;
}

function MapHoverCard({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const mapQ = useQuery({
    queryKey: ['db', 'map', id],
    queryFn: () => client.getMap(id),
    staleTime: 5 * 60_000,
  });

  if (mapQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!mapQ.data) {
    return <p className="text-muted-foreground text-xs">Map {id} not found.</p>;
  }
  const m = mapQ.data;
  const display = m.name ?? `Map ${id}`;

  return (
    <div className="w-72 space-y-1.5">
      <div className="flex gap-3">
        <EntityIcon
          entity="map-mini"
          id={id}
          placeholder={MapIcon}
          fit={{ maxWidth: 72, maxHeight: 64 }}
          alt={display}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <div className="truncate text-sm font-semibold">{display}</div>
            <div className="text-muted-foreground font-mono text-[10px]">Map #{id}</div>
          </div>
          {m.streetName && (
            <div className="text-muted-foreground truncate text-[11px]">{m.streetName}</div>
          )}
          {m.mobRate !== null && (
            <div className="text-muted-foreground text-[11px]">
              Mob rate: <span className="text-foreground font-mono">{m.mobRate.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
      <HoverCardSaveFooter entityType="map" entityId={id} />
    </div>
  );
}
