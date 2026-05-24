import type { ColumnDef } from '@tanstack/react-table';
import { Crown, Skull } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import type { MobRecord } from '@/db';

export const columns: ColumnDef<MobRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityIcon
        entity="mob"
        id={row.original.id}
        size={28}
        placeholder={Skull}
        alt={row.original.name}
      />
    ),
  },
  {
    id: 'name',
    accessorFn: (m) => m.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {row.original.isBoss && (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            <Crown className="h-3 w-3" />
            Boss
          </span>
        )}
      </span>
    ),
  },
  {
    id: 'level',
    accessorFn: (m) => m.level,
    header: 'Level',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.level ?? '—',
  },
  {
    id: 'hp',
    accessorFn: (m) => m.hp,
    header: 'HP',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.hp?.toLocaleString() ?? '—',
  },
  {
    id: 'mp',
    accessorFn: (m) => m.mp,
    header: 'MP',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.mp?.toLocaleString() ?? '—',
  },
  {
    id: 'exp',
    accessorFn: (m) => m.exp,
    header: 'EXP',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.exp?.toLocaleString() ?? '—',
  },
  {
    id: 'element',
    accessorFn: (m) => m.elementAttack,
    header: 'Element',
    meta: { filter: 'string' },
    cell: ({ row }) => row.original.elementAttack ?? '—',
  },
  {
    id: 'id',
    accessorFn: (m) => m.id,
    header: 'ID',
    meta: { filter: 'number' },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = ['icon', 'name', 'level', 'hp', 'exp'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'level', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};
