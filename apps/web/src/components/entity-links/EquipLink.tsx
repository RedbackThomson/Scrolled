import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ItemIcon } from '@/components/ItemIcon';
import { HoverPopover } from '@/components/HoverPopover';
import { getDbClient } from '@/db';

interface EquipLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
}

export function EquipLink({ id, children, className, noPreview }: EquipLinkProps) {
  const link = (
    <Link to={`/equips/${id}`} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return <HoverPopover content={<EquipHoverCard id={id} />}>{link}</HoverPopover>;
}

function EquipHoverCard({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const equipQ = useQuery({
    queryKey: ['db', 'equip', id],
    queryFn: () => client.getEquip(id),
    staleTime: 5 * 60_000,
  });

  if (equipQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!equipQ.data) {
    return <p className="text-muted-foreground text-xs">Equip {id} not found.</p>;
  }
  const e = equipQ.data;

  const stats: { label: string; value: number | null }[] = [
    { label: 'Atk', value: e.attack },
    { label: 'M.Atk', value: e.magicAttack },
    { label: 'Def', value: e.defense },
    { label: 'M.Def', value: e.magicDefense },
  ].filter((s) => s.value !== null && s.value !== 0) as { label: string; value: number }[];

  return (
    <div className="flex w-72 gap-3">
      <ItemIcon entity="equip" id={id} size={64} alt={e.name} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div>
          <div className="truncate text-sm font-semibold">{e.name}</div>
          <div className="text-muted-foreground font-mono text-[10px]">Equip #{id}</div>
        </div>
        {(e.slot || e.requiredLevel !== null) && (
          <div className="text-muted-foreground text-[11px]">
            {e.slot && <span className="capitalize">{e.slot}</span>}
            {e.slot && e.requiredLevel !== null && ' · '}
            {e.requiredLevel !== null && <>Req Lv {e.requiredLevel}</>}
          </div>
        )}
        {e.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs">{e.description}</p>
        )}
        {stats.length > 0 && (
          <dl className="text-muted-foreground grid grid-cols-4 gap-1 text-[11px]">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="uppercase tracking-wide">{s.label}</dt>
                <dd className="text-foreground font-mono">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
