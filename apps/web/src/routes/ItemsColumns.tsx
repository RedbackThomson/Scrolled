import type { ColumnDef } from '@tanstack/react-table';
import { Coins, Gauge, Hash, Tag } from 'lucide-react';
import { ItemIcon } from '@/components/entity-display/ItemIcon';
import { ItemLink } from '@/components/entity-links';
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
    cell: ({ row }) => (
      <ItemLink id={row.original.id} className="font-medium">
        {row.original.name}
      </ItemLink>
    ),
  },
  {
    id: 'category',
    accessorFn: (i) => i.category,
    header: 'Category',
    meta: { filter: 'enum', icon: Tag },
    cell: ({ row }) => <span className="capitalize">{row.original.category ?? '—'}</span>,
  },
  {
    id: 'subcategory',
    accessorFn: (i) => i.subcategory,
    header: 'Subcategory',
    meta: {
      filter: 'string',
      icon: Tag,
      card: { label: 'Subcategory', render: (row) => row.subcategory ?? '—' },
    },
    cell: ({ row }) => row.original.subcategory ?? '—',
  },
  {
    id: 'requiredLevel',
    accessorFn: (i) => i.requiredLevel,
    header: 'Req Lvl',
    meta: {
      filter: 'number',
      icon: Gauge,
      card: { label: 'Req Lvl', render: (row) => row.requiredLevel ?? '—' },
    },
    cell: ({ row }) => row.original.requiredLevel ?? '—',
  },
  {
    id: 'price',
    accessorFn: (i) => i.price,
    header: 'Price',
    meta: {
      filter: 'number',
      icon: Coins,
      card: {
        label: 'Price',
        render: (row) => (row.price === null ? '—' : row.price.toLocaleString()),
      },
    },
    cell: ({ row }) => (row.original.price === null ? '—' : row.original.price.toLocaleString()),
  },
  {
    id: 'id',
    accessorFn: (i) => i.id,
    header: 'ID',
    meta: {
      filter: 'string',
      icon: Hash,
      card: { label: 'ID', render: (row) => row.id },
    },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = ['icon', 'name', 'category'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

export function mobileCard(row: ItemRecord) {
  const meta: string[] = [];
  if (row.subcategory) meta.push(row.subcategory);
  else if (row.category) meta.push(row.category);
  if (row.requiredLevel !== null) meta.push(`Lvl ${row.requiredLevel}`);
  return (
    <div className="flex items-center gap-3">
      <ItemIcon entity="item" id={row.id} size={40} alt={row.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{row.name}</div>
        {meta.length > 0 && (
          <div className="text-muted-foreground truncate text-xs capitalize">
            {meta.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}
