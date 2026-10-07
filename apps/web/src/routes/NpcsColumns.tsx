import type { ColumnDef } from '@tanstack/react-table';
import { Hash } from 'lucide-react';
import { NpcLink } from '@/components/entity-links';
import type { NpcRecord } from '@/db';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { ListCardBody } from '@/components/data-table/ListCardBody';

export const columns: ColumnDef<NpcRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityAvatar entity="npc" id={row.original.id} size={36} alt={row.original.name} />
    ),
  },
  {
    id: 'name',
    accessorFn: (n) => n.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <NpcLink id={row.original.id} className="font-semibold">
        {row.original.name}
      </NpcLink>
    ),
  },
  {
    id: 'id',
    accessorFn: (n) => n.id,
    header: 'ID',
    meta: {
      filter: 'string',
      icon: Hash,
      card: { label: 'ID', render: (row) => row.id },
    },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = ['icon', 'name'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

export function mobileCard(row: NpcRecord) {
  return (
    <ListCardBody
      entity="npc"
      id={row.id}
      name={row.name}
      subtitle={<span className="font-mono">{row.id}</span>}
    />
  );
}
