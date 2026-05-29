import type { ColumnDef } from '@tanstack/react-table';
import { ScrollText } from 'lucide-react';
import { QuestLink } from '@/components/entity-links';
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
    cell: ({ row }) => (
      <QuestLink id={row.original.id} className="font-medium">
        {row.original.name}
      </QuestLink>
    ),
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

export function mobileCard(row: QuestRecord) {
  const meta: string[] = [];
  if (row.parent) meta.push(row.parent);
  if (row.requiredLevel !== null) meta.push(`req Lv ${row.requiredLevel}`);
  return (
    <div className="flex items-center gap-3">
      <ScrollText className="text-muted-foreground h-8 w-8 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{row.name}</div>
        {meta.length > 0 && (
          <div className="text-muted-foreground truncate text-xs">{meta.join(' · ')}</div>
        )}
      </div>
    </div>
  );
}
