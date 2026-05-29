import type { ColumnDef } from '@tanstack/react-table';
import { Users } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { NpcLink } from '@/components/entity-links';
import type { NpcRecord } from '@/db';

export const columns: ColumnDef<NpcRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityIcon
        entity="npc"
        id={row.original.id}
        size={28}
        placeholder={Users}
        alt={row.original.name}
      />
    ),
  },
  {
    id: 'name',
    accessorFn: (n) => n.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <NpcLink id={row.original.id} className="font-medium">
        {row.original.name}
      </NpcLink>
    ),
  },
  {
    id: 'id',
    accessorFn: (n) => n.id,
    header: 'ID',
    meta: { filter: 'number' },
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
    <div className="flex items-center gap-3">
      <EntityIcon entity="npc" id={row.id} size={40} placeholder={Users} alt={row.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{row.name}</div>
        <div className="text-muted-foreground truncate font-mono text-xs">{row.id}</div>
      </div>
    </div>
  );
}
