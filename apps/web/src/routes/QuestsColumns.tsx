import type { ColumnDef } from '@tanstack/react-table';
import { ScrollText } from 'lucide-react';
import type { QuestRecord } from '@/db';

export const columns: ColumnDef<QuestRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: () => <ScrollText className="text-muted-foreground h-5 w-5" />,
  },
  {
    id: 'name',
    accessorFn: (q) => q.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    id: 'parent',
    accessorFn: (q) => q.parent,
    header: 'Area',
    meta: { filter: 'enum' },
    cell: ({ row }) => row.original.parent ?? '—',
  },
  {
    id: 'requiredLevel',
    accessorFn: (q) => q.requiredLevel,
    header: 'Req Lv',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.requiredLevel ?? '—',
  },
  {
    id: 'id',
    accessorFn: (q) => q.id,
    header: 'ID',
    meta: { filter: 'number' },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = ['icon', 'name', 'parent', 'requiredLevel'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};
