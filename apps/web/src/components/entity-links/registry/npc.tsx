import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { getDbClient, type MapRecord, type NpcRecord } from '@/db';
import { routeForEntity } from '@/lib/entityRoutes';
import type { TooltipEntityConfig, TooltipField } from './types';

interface NpcExtra {
  maps: MapRecord[];
}

type NpcField = TooltipField<NpcRecord, NpcExtra>;

const fields: NpcField[] = [
  {
    key: 'description',
    label: 'Description',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.description?.trim(),
    render: ({ record }) => (
      <p className="text-muted-foreground line-clamp-2 text-xs">{record.description}</p>
    ),
  },
  {
    key: 'maps',
    label: 'Found in',
    hint: 'Maps where this NPC appears (up to four).',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ extra }) => extra.maps.length > 0,
    render: ({ extra }) => (
      <div>
        <div className="text-muted-foreground mb-0.5 text-[10px] uppercase tracking-wide">
          Found in
        </div>
        <ul className="space-y-0.5 text-xs">
          {extra.maps.slice(0, 4).map((m) => (
            <li key={m.id}>
              <Link
                to={routeForEntity('map', m.id)}
                className="text-primary block truncate hover:underline"
              >
                {m.name ?? `Map ${m.id}`}
              </Link>
            </li>
          ))}
          {extra.maps.length > 4 && (
            <li className="text-muted-foreground">…{extra.maps.length - 4} more</li>
          )}
        </ul>
      </div>
    ),
  },
];

export const npcConfig: TooltipEntityConfig<NpcRecord, NpcExtra> = {
  entity: 'npc',
  idPrefix: 'NPC',
  fetch: (id) => getDbClient().getNpc(id),
  queryKey: (id) => ['db', 'npc', id],
  useExtraData: (id) => {
    const client = useMemo(() => getDbClient(), []);
    const mapsQ = useQuery({
      queryKey: ['db', 'npc-maps', id],
      queryFn: () => client.getNpcMaps(id),
      staleTime: 5 * 60_000,
    });
    return { maps: mapsQ.data ?? [] };
  },
  renderIcon: (record, id) => (
    <EntityIcon entity="npc" id={id} size={64} placeholder={Users} alt={record.name} />
  ),
  renderName: (record, id) => (
    <Link
      to={routeForEntity('npc', id)}
      className="hover:text-primary block truncate text-sm font-semibold hover:underline"
    >
      {record.name}
    </Link>
  ),
  getSampleId: () => getDbClient().listNpcs({ limit: 1 }).then((r) => r.rows[0]?.id ?? null),
  fields,
};
