import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DoorOpen, Map as MapIcon, Skull, Users } from 'lucide-react';
import { isUsefulPortal } from '@scrolled/game-db/domain/portal-types';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { getDbClient, type MapRecord } from '@/db';
import { routeForEntity } from '@/lib/entityRoutes';
import { CountPill } from './CountPill';
import { Num } from './shared';
import type { TooltipEntityConfig, TooltipField } from './types';

interface MapExtra {
  mobs: number;
  npcs: number;
  portals: number;
}

type MapField = TooltipField<MapRecord, MapExtra>;

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

const fields: MapField[] = [
  {
    key: 'streetName',
    label: 'Street name',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.streetName?.trim(),
    render: ({ record }) => (
      <div className="text-muted-foreground -mt-1 truncate text-xs">{record.streetName ?? '—'}</div>
    ),
  },
  {
    key: 'minimap',
    label: 'Minimap',
    zone: 'body',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.minimapPath,
    render: ({ record, id }) => (
      <div className="grid h-24 place-items-center overflow-hidden rounded-xl bg-white/[.05] [&_img]:max-h-none [&_img]:max-w-none">
        <EntityIcon
          entity="map-mini"
          id={id}
          placeholder={MapIcon}
          fit={{ maxWidth: 276, maxHeight: 96 }}
          alt={`Minimap for ${record.name ?? `Map ${id}`}`}
        />
      </div>
    ),
  },
  {
    key: 'contents',
    label: 'Mobs, NPCs and portals',
    hint: 'How many mob types, NPCs and travelable portals the map has.',
    zone: 'body',
    defaultMode: 'whenPresent',
    isPresent: ({ extra }) => extra.mobs + extra.npcs + extra.portals > 0,
    render: ({ extra }) => (
      <div className="flex flex-wrap gap-1.5">
        {extra.mobs > 0 && (
          <CountPill icon={Skull} hue={15}>
            {plural(extra.mobs, 'mob', 'mobs')}
          </CountPill>
        )}
        {extra.npcs > 0 && (
          <CountPill icon={Users} hue={75}>
            {plural(extra.npcs, 'NPC', 'NPCs')}
          </CountPill>
        )}
        {extra.portals > 0 && (
          <CountPill icon={DoorOpen} hue={235}>
            {plural(extra.portals, 'portal', 'portals')}
          </CountPill>
        )}
      </div>
    ),
  },
  {
    key: 'mobRate',
    label: 'Mob rate',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => record.mobRate !== null,
    render: ({ record }) => (
      <div className="text-muted-foreground text-[11px]">
        Mob rate: <Num>{record.mobRate?.toFixed(2) ?? '—'}</Num>
      </div>
    ),
  },
  {
    key: 'fieldLimit',
    label: 'Field limit',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'never',
    isPresent: ({ record }) => record.fieldLimit !== null && record.fieldLimit !== 0,
    render: ({ record }) => (
      <div className="text-muted-foreground text-[11px]">
        Field limit: <Num>{record.fieldLimit ?? '—'}</Num>
      </div>
    ),
  },
];

export const mapConfig: TooltipEntityConfig<MapRecord, MapExtra> = {
  entity: 'map',
  idPrefix: 'Map',
  fetch: (id) => getDbClient().getMap(id),
  queryKey: (id) => ['db', 'map', id],
  // Keys match the map page's, so hovering then opening the map reuses the data.
  useExtraData: (id) => {
    const client = useMemo(() => getDbClient(), []);
    const mobsQ = useQuery({
      queryKey: ['db', 'map', id, 'mobs'],
      queryFn: () => client.getMapMobs(id),
      staleTime: 5 * 60_000,
    });
    const npcsQ = useQuery({
      queryKey: ['db', 'map', id, 'npcs'],
      queryFn: () => client.getMapNpcs(id),
      staleTime: 5 * 60_000,
    });
    const portalsQ = useQuery({
      queryKey: ['db', 'map', id, 'portals'],
      queryFn: () => client.getMapPortals(id),
      staleTime: 5 * 60_000,
    });
    return {
      mobs: mobsQ.data?.length ?? 0,
      npcs: npcsQ.data?.length ?? 0,
      portals: portalsQ.data?.filter((p) => isUsefulPortal(p, id)).length ?? 0,
    };
  },
  iconTile: { size: 40, hue: 185 },
  renderIcon: () => <MapIcon className="h-[18px] w-[18px]" aria-hidden />,
  nameOf: (record, id) => record.name ?? `Map ${id}`,
  renderName: (record, id) => (
    <Link
      to={routeForEntity('map', id)}
      className="hover:text-primary block truncate hover:underline"
    >
      {record.name ?? `Map ${id}`}
    </Link>
  ),
  getSampleId: () =>
    getDbClient()
      .listMaps({ limit: 1 })
      .then((r) => r.rows[0]?.id ?? null),
  fields,
};
