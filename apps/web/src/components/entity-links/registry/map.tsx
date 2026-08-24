import { Link } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { getDbClient, type MapRecord } from '@/db';
import { routeForEntity } from '@/lib/entityRoutes';
import { Mono } from './shared';
import type { TooltipEntityConfig, TooltipField } from './types';

type MapField = TooltipField<MapRecord, Record<string, never>>;

const fields: MapField[] = [
  {
    key: 'streetName',
    label: 'Street name',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.streetName?.trim(),
    render: ({ record }) => (
      <div className="text-muted-foreground truncate text-[11px]">{record.streetName ?? '—'}</div>
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
        Mob rate: <Mono>{record.mobRate?.toFixed(2) ?? '—'}</Mono>
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
        Field limit: <Mono>{record.fieldLimit ?? '—'}</Mono>
      </div>
    ),
  },
];

export const mapConfig: TooltipEntityConfig<MapRecord> = {
  entity: 'map',
  idPrefix: 'Map',
  fetch: (id) => getDbClient().getMap(id),
  queryKey: (id) => ['db', 'map', id],
  renderIcon: (record, id) => (
    <EntityIcon
      entity="map-mini"
      id={id}
      placeholder={MapIcon}
      fit={{ maxWidth: 72, maxHeight: 64 }}
      alt={record.name ?? `Map ${id}`}
    />
  ),
  renderName: (record, id) => (
    <Link
      to={routeForEntity('map', id)}
      className="hover:text-primary block truncate text-sm font-semibold hover:underline"
    >
      {record.name ?? `Map ${id}`}
    </Link>
  ),
  getSampleId: () => getDbClient().listMaps({ limit: 1 }).then((r) => r.rows[0]?.id ?? null),
  fields,
};
