import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ConsumableSpecRecord } from '@scrolled/game-db/db';
import { buildConsumableEffects, type EntityRef } from '@/lib/consumableEffects';
import { InfoRow, InfoSection } from '@/components/layout/DetailPageLayout';
import { MapLink } from '@/components/entity-links/MapLink';
import { MobLink } from '@/components/entity-links/MobLink';
import { NpcLink } from '@/components/entity-links/NpcLink';
import { getDbClient } from '@/db';

/**
 * Renders a consumable's effects as an aside "Effects" section of label/value
 * rows — the same shape as the Info/Stats sections. Returns null when there's
 * nothing to show so the caller can drop the section entirely.
 */
export function ConsumableEffects({ spec }: { spec: ConsumableSpecRecord }) {
  const rows = useMemo(() => buildConsumableEffects(spec), [spec]);
  if (rows.length === 0) return null;

  return (
    <InfoSection title="Effects">
      {rows.map((row, i) => (
        <InfoRow
          key={i}
          label={row.label}
          value={
            row.refs && row.refs.length > 0 ? (
              <span className="flex flex-col items-end gap-0.5">
                {row.refs.map((ref, j) => (
                  <span key={`${ref.entity}-${ref.id}-${j}`}>
                    <EntityRefLink refData={ref} />
                    {ref.note && ` ${ref.note}`}
                  </span>
                ))}
              </span>
            ) : (
              row.value
            )
          }
        />
      ))}
    </InfoSection>
  );
}

const LINK_CLASS = 'text-primary hover:underline';

function EntityRefLink({ refData }: { refData: EntityRef }) {
  switch (refData.entity) {
    case 'map':
      return <MapRefLink id={refData.id} />;
    case 'npc':
      return <NpcRefLink id={refData.id} />;
    case 'mob':
      return <MobRefLink id={refData.id} />;
  }
}

function MapRefLink({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const q = useQuery({
    queryKey: ['db', 'map', id],
    queryFn: () => client.getMap(id),
    staleTime: 5 * 60_000,
  });
  return (
    <MapLink id={id} className={LINK_CLASS}>
      {q.data?.name ?? `Map ${id}`}
    </MapLink>
  );
}

function NpcRefLink({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const q = useQuery({
    queryKey: ['db', 'npc', id],
    queryFn: () => client.getNpc(id),
    staleTime: 5 * 60_000,
  });
  return (
    <NpcLink id={id} className={LINK_CLASS}>
      {q.data?.name ?? `NPC ${id}`}
    </NpcLink>
  );
}

function MobRefLink({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const q = useQuery({
    queryKey: ['db', 'mob', id],
    queryFn: () => client.getMob(id),
    staleTime: 5 * 60_000,
  });
  return (
    <MobLink id={id} className={LINK_CLASS}>
      {q.data?.name ?? `Mob ${id}`}
    </MobLink>
  );
}
