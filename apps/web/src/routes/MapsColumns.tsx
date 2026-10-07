import type { ColumnDef } from '@tanstack/react-table';
import { Activity, Hash, MapPin, RotateCcw } from 'lucide-react';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { MapLink } from '@/components/entity-links';
import type { MapRecord } from '@/db';
import { ListCardBody } from '@/components/data-table/ListCardBody';

export const columns: ColumnDef<MapRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityAvatar
        entity="map"
        id={row.original.id}
        size={36}
        alt={row.original.name ?? `Map ${row.original.id}`}
      />
    ),
  },
  {
    id: 'name',
    accessorFn: (m) => m.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <MapLink id={row.original.id} className="font-semibold">
        {row.original.name ?? `Map ${row.original.id}`}
      </MapLink>
    ),
  },
  {
    id: 'streetName',
    accessorFn: (m) => m.streetName,
    header: 'Street',
    meta: { filter: 'string', icon: MapPin },
    cell: ({ row }) => row.original.streetName ?? '—',
  },
  {
    id: 'mobRate',
    accessorFn: (m) => m.mobRate,
    header: 'Mob Rate',
    meta: {
      filter: 'number',
      icon: Activity,
      card: {
        label: 'Mob Rate',
        render: (row) => (row.mobRate === null ? '—' : row.mobRate.toFixed(2)),
      },
    },
    cell: ({ row }) => (row.original.mobRate === null ? '—' : row.original.mobRate.toFixed(2)),
  },
  {
    id: 'returnMapId',
    accessorFn: (m) => m.returnMapId,
    header: 'Return',
    meta: {
      filter: 'number',
      icon: RotateCcw,
      card: { label: 'Return', render: (row) => row.returnMapId ?? '—' },
    },
    cell: ({ row }) =>
      row.original.returnMapId === null ? (
        '—'
      ) : (
        <span className="font-mono text-xs">{row.original.returnMapId}</span>
      ),
  },
  {
    id: 'id',
    accessorFn: (m) => m.id,
    header: 'ID',
    meta: {
      filter: 'string',
      icon: Hash,
      card: { label: 'ID', render: (row) => row.id },
    },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = ['icon', 'name', 'streetName'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

export function mobileCard(row: MapRecord) {
  return (
    <ListCardBody
      entity="map"
      id={row.id}
      name={row.name ?? `Map ${row.id}`}
      subtitle={row.streetName ?? undefined}
      stats={row.mobRate === null ? [] : [{ label: 'Mob rate', value: row.mobRate.toFixed(2) }]}
    />
  );
}
