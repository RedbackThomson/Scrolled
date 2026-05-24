import type { ColumnDef } from '@tanstack/react-table';
import { Map as MapIcon } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
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
      <span className="font-medium">{row.original.name ?? `Map ${row.original.id}`}</span>
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
    meta: { filter: 'number' },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = ['icon', 'name', 'streetName'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};
