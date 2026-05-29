import type { ColumnDef } from '@tanstack/react-table';
import { Map as MapIcon } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { MapLink } from '@/components/entity-links';
import type { MapRecord } from '@/db';

export const columns: ColumnDef<MapRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityIcon
        entity="map-mini"
        id={row.original.id}
        placeholder={MapIcon}
        fit={{ maxWidth: 56, maxHeight: 28 }}
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
      <MapLink id={row.original.id} className="font-medium">
        {row.original.name ?? `Map ${row.original.id}`}
      </MapLink>
    ),
  },
  {
    id: 'streetName',
    accessorFn: (m) => m.streetName,
    header: 'Street',
    meta: { filter: 'string' },
    cell: ({ row }) => row.original.streetName ?? '—',
  },
  {
    id: 'mobRate',
    accessorFn: (m) => m.mobRate,
    header: 'Mob Rate',
    meta: { filter: 'number' },
    cell: ({ row }) => (row.original.mobRate === null ? '—' : row.original.mobRate.toFixed(2)),
  },
  {
    id: 'returnMapId',
    accessorFn: (m) => m.returnMapId,
    header: 'Return',
    meta: { filter: 'number' },
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
    meta: { filter: 'string' },
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
    <div className="flex items-center gap-3">
      <EntityIcon
        entity="map-mini"
        id={row.id}
        placeholder={MapIcon}
        fit={{ maxWidth: 56, maxHeight: 40 }}
        alt={row.name ?? `Map ${row.id}`}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{row.name ?? `Map ${row.id}`}</div>
        {row.streetName && (
          <div className="text-muted-foreground truncate text-xs">{row.streetName}</div>
        )}
      </div>
    </div>
  );
}
