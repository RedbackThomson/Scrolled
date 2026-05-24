import type { ColumnDef } from '@tanstack/react-table';
import { ItemIcon } from '@/components/ItemIcon';
import type { ItemRecord } from '@/db';

export const columns: ColumnDef<ItemRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <ItemIcon entity="item" id={row.original.id} size={28} alt={row.original.name} />
    ),
  },
  {
    id: 'name',
    accessorFn: (i) => i.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    id: 'category',
    accessorFn: (i) => i.category,
    header: 'Category',
    meta: { filter: 'enum' },
    cell: ({ row }) => <span className="capitalize">{row.original.category ?? '—'}</span>,
  },
  {
    id: 'subcategory',
    accessorFn: (i) => i.subcategory,
    header: 'Subcategory',
    meta: { filter: 'string' },
    cell: ({ row }) => row.original.subcategory ?? '—',
  },
  {
    id: 'requiredLevel',
    accessorFn: (i) => i.requiredLevel,
    header: 'Req Lv',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.requiredLevel ?? '—',
  },
  {
    id: 'price',
    accessorFn: (i) => i.price,
    header: 'Price',
    meta: { filter: 'number' },
    cell: ({ row }) => (row.original.price === null ? '—' : row.original.price.toLocaleString()),
  },
  {
    id: 'id',
    accessorFn: (i) => i.id,
    header: 'ID',
    meta: { filter: 'number' },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = ['icon', 'name', 'category'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};
