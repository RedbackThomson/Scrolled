import type { ColumnDef } from '@tanstack/react-table';
import {
  Armchair,
  ArrowUp,
  Coins,
  Gauge,
  Hash,
  Heart,
  ScrollText,
  Sparkles,
  Sword,
  Tag,
  Timer,
  Wind,
} from 'lucide-react';
import { Chip } from '@scrolled/design';
import { ItemLink } from '@/components/entity-links';
import { formatDurationSeconds } from '@/lib/duration';
import type { ItemListRow } from '@/db';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { ListCardBody } from '@/components/data-table/ListCardBody';
import type { ListCardStat } from '@/components/data-table/listCardLayout';
import type { FacetDef } from '@/components/data-table/presets';

const num = (v: number | null) => (v == null ? '—' : String(v));
const signedNum = (v: number | null) => (v == null ? '—' : v >= 0 ? `+${v}` : `−${Math.abs(v)}`);
const dur = (v: number | null) => (v == null ? '—' : formatDurationSeconds(v, { short: true }));

export const columns: ColumnDef<ItemListRow>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityAvatar entity="item" id={row.original.id} size={36} alt={row.original.name} />
    ),
  },
  {
    id: 'name',
    accessorFn: (i) => i.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <ItemLink id={row.original.id} className="font-semibold">
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
    id: 'recoveryHp',
    accessorFn: (i) => i.recoveryHp,
    header: 'HP',
    meta: {
      filter: 'number',
      icon: Heart,
      card: { label: 'HP restored', render: (row) => num(row.recoveryHp) },
    },
    cell: ({ row }) => num(row.original.recoveryHp),
  },
  {
    id: 'recoveryMp',
    accessorFn: (i) => i.recoveryMp,
    header: 'MP',
    meta: {
      filter: 'number',
      icon: Sparkles,
      card: { label: 'MP restored', render: (row) => num(row.recoveryMp) },
    },
    cell: ({ row }) => num(row.original.recoveryMp),
  },
  {
    id: 'buffDurationSeconds',
    accessorFn: (i) => i.buffDurationSeconds,
    header: 'Duration',
    meta: {
      filter: 'number',
      icon: Timer,
      card: { label: 'Buff duration', render: (row) => dur(row.buffDurationSeconds) },
    },
    cell: ({ row }) => dur(row.original.buffDurationSeconds),
  },
  {
    id: 'buffWeaponAttack',
    accessorFn: (i) => i.buffWeaponAttack,
    header: 'W.Atk',
    meta: {
      filter: 'number',
      icon: Sword,
      card: { label: 'Weapon Attack', render: (row) => signedNum(row.buffWeaponAttack) },
    },
    cell: ({ row }) => signedNum(row.original.buffWeaponAttack),
  },
  {
    id: 'buffSpeed',
    accessorFn: (i) => i.buffSpeed,
    header: 'Speed',
    meta: {
      filter: 'number',
      icon: Wind,
      card: { label: 'Speed', render: (row) => signedNum(row.buffSpeed) },
    },
    cell: ({ row }) => signedNum(row.original.buffSpeed),
  },
  {
    id: 'buffJump',
    accessorFn: (i) => i.buffJump,
    header: 'Jump',
    meta: {
      filter: 'number',
      icon: ArrowUp,
      card: { label: 'Jump', render: (row) => signedNum(row.buffJump) },
    },
    cell: ({ row }) => signedNum(row.original.buffJump),
  },
  {
    id: 'quest',
    accessorFn: (i) => i.quest,
    header: 'Quest',
    meta: {
      filter: 'boolean',
      booleanLabels: { trueLabel: 'Quest item', falseLabel: 'Not a quest item' },
      icon: ScrollText,
    },
    cell: ({ row }) =>
      row.original.quest ? (
        <Chip tone="hue" hue={150}>
          Quest
        </Chip>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'chair',
    accessorFn: (i) => i.isChair,
    header: 'Chair',
    meta: {
      filter: 'boolean',
      booleanLabels: { trueLabel: 'Chair', falseLabel: 'Not a chair' },
      icon: Armchair,
    },
    cell: ({ row }) =>
      row.original.isChair ? (
        <Chip tone="hue" hue={70}>
          Chair
        </Chip>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
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

export const defaultVisible = ['icon', 'name', 'category', 'recoveryHp', 'recoveryMp'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

export function mobileCard(row: ItemListRow) {
  const stats: ListCardStat[] = [];
  if (row.recoveryHp !== null) stats.push({ label: 'HP', value: row.recoveryHp.toLocaleString() });
  if (row.recoveryMp !== null) stats.push({ label: 'MP', value: row.recoveryMp.toLocaleString() });
  if (row.requiredLevel !== null) stats.push({ label: 'Req Lv', value: row.requiredLevel });
  if (row.price !== null) stats.push({ label: 'Price', value: row.price.toLocaleString() });
  return (
    <ListCardBody
      entity="item"
      id={row.id}
      name={row.name}
      subtitle={
        (row.subcategory ?? row.category) && (
          <span className="capitalize">{row.subcategory ?? row.category}</span>
        )
      }
      stats={stats}
    />
  );
}

export const facets: readonly FacetDef[] = [
  { columnId: 'category', label: 'Category', hue: 235 },
  { columnId: 'subcategory', label: 'Subcategory', hue: 185 },
  { columnId: 'requiredLevel', label: 'Req Lvl', hue: 148, aroundMyLevel: true },
  { columnId: 'price', label: 'Price', hue: 75 },
];
