import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { HoverPopover } from '@/components/HoverPopover';
import { HoverCardSaveFooter } from '@/components/collections';
import { MapLink } from '@/components/entity-links/MapLink';
import { getDbClient } from '@/db';

interface NpcLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  /** Opt out of the hover preview (e.g. when the row already conveys
   *  the same info). */
  noPreview?: boolean;
}

export function NpcLink({ id, children, className, noPreview }: NpcLinkProps) {
  const link = (
    <Link to={`/npcs/${id}`} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return <HoverPopover content={<NpcHoverCard id={id} />}>{link}</HoverPopover>;
}

export function NpcHoverCard({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const npcQ = useQuery({
    queryKey: ['db', 'npc', id],
    queryFn: () => client.getNpc(id),
    staleTime: 5 * 60_000,
  });
  const mapsQ = useQuery({
    queryKey: ['db', 'npc-maps', id],
    queryFn: () => client.getNpcMaps(id),
    staleTime: 5 * 60_000,
  });

  if (npcQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!npcQ.data) {
    return <p className="text-muted-foreground text-xs">NPC {id} not found.</p>;
  }
  const npc = npcQ.data;
  const maps = mapsQ.data ?? [];

  return (
    <div className="w-72 space-y-1.5">
      <div className="flex gap-3">
        <EntityIcon entity="npc" id={id} size={64} placeholder={Users} alt={npc.name} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <Link
              to={`/npcs/${id}`}
              className="hover:text-primary block truncate text-sm font-semibold hover:underline"
            >
              {npc.name}
            </Link>
            <div className="text-muted-foreground font-mono text-[10px]">NPC #{id}</div>
          </div>
          {npc.description && (
            <p className="text-muted-foreground line-clamp-2 text-xs">{npc.description}</p>
          )}
          {maps.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-0.5 text-[10px] uppercase tracking-wide">
                Found in
              </div>
              <ul className="space-y-0.5 text-xs">
                {maps.slice(0, 4).map((m) => (
                  <li key={m.id}>
                    <MapLink
                      id={m.id}
                      noPreview
                      className="text-primary block truncate hover:underline"
                    >
                      {m.name ?? `Map ${m.id}`}
                    </MapLink>
                  </li>
                ))}
                {maps.length > 4 && (
                  <li className="text-muted-foreground">…{maps.length - 4} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
      <HoverCardSaveFooter entityType="npc" entityId={id} />
    </div>
  );
}
