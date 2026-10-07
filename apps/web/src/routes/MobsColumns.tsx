import type { ColumnDef } from '@tanstack/react-table';
import { Crown, Divide, Flame, Gauge, Hash, Heart, Sparkles, TrendingUp } from 'lucide-react';
import { ExpValue } from '@/components/entity-display/ExpValue';
import { MobLink } from '@/components/entity-links';
import type { MobRecord } from '@/db';
import { elementsByStatus, type ElementStatus } from '@scrolled/game-db/domain/mobElements';
import {
  ELEMENT_GROUP_LABELS,
  ELEMENT_STATUS_CLASSES,
} from '@/components/entity-display/mobElementsDisplay';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { Chip } from '@scrolled/design';
import { ListCardBody } from '@/components/data-table/ListCardBody';
import type { ListCardStat } from '@/components/data-table/listCardLayout';

/** Statuses that get their own column in the listing. Maps each to the
 *  public column id used in URL state and filter keys. */
const COLUMN_STATUSES: readonly { id: string; status: ElementStatus }[] = [
  { id: 'weakAgainst', status: 'weak' },
  { id: 'strongAgainst', status: 'resistant' },
  { id: 'immuneTo', status: 'immune' },
];

function formatExpHp(m: MobRecord): string {
  return m.exp !== null && m.hp
    ? (m.exp / m.hp).toLocaleString(undefined, { maximumFractionDigits: 3 })
    : '—';
}

const elementColumns: ColumnDef<MobRecord>[] = COLUMN_STATUSES.map(({ id, status }) => ({
  id,
  header: ELEMENT_GROUP_LABELS[status],
  enableSorting: false,
  meta: {
    filter: 'enum',
    icon: Flame,
    card: {
      label: ELEMENT_GROUP_LABELS[status],
      render: (row: MobRecord) => {
        const values = elementsByStatus(row.elementAttack, status);
        return values.length === 0 ? '—' : values.join(', ');
      },
    },
  },
  cell: ({ row }) => {
    const values = elementsByStatus(row.original.elementAttack, status);
    if (values.length === 0) return <span className="text-muted-foreground">—</span>;
    return <span className={ELEMENT_STATUS_CLASSES[status]}>{values.join(', ')}</span>;
  },
}));

export const columns: ColumnDef<MobRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityAvatar entity="mob" id={row.original.id} size={36} alt={row.original.name} />
    ),
  },
  {
    id: 'name',
    accessorFn: (m) => m.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <MobLink id={row.original.id} className="inline-flex items-center gap-2">
        <span className="font-semibold">{row.original.name}</span>
        {row.original.isBoss && (
          <Chip tone="gold" icon={Crown}>
            Boss
          </Chip>
        )}
      </MobLink>
    ),
  },
  {
    id: 'level',
    accessorFn: (m) => m.level,
    header: 'Level',
    meta: { filter: 'number', icon: Gauge },
    cell: ({ row }) => row.original.level ?? '—',
  },
  {
    id: 'hp',
    accessorFn: (m) => m.hp,
    header: 'HP',
    meta: { filter: 'number', icon: Heart },
    cell: ({ row }) => row.original.hp?.toLocaleString() ?? '—',
  },
  {
    id: 'mp',
    accessorFn: (m) => m.mp,
    header: 'MP',
    meta: {
      filter: 'number',
      icon: Sparkles,
      card: { label: 'MP', render: (row) => row.mp?.toLocaleString() ?? '—' },
    },
    cell: ({ row }) => row.original.mp?.toLocaleString() ?? '—',
  },
  {
    id: 'exp',
    accessorFn: (m) => m.exp,
    header: 'EXP',
    meta: { filter: 'number', icon: TrendingUp },
    cell: ({ row }) => <ExpValue exp={row.original.exp} />,
  },
  {
    id: 'expHp',
    accessorFn: (m) => (m.exp !== null && m.hp ? m.exp / m.hp : null),
    header: 'EXP/HP',
    meta: {
      icon: Divide,
      card: { label: 'EXP/HP', render: (row) => formatExpHp(row) },
    },
    cell: ({ row }) => formatExpHp(row.original),
  },
  ...elementColumns,
  {
    id: 'boss',
    accessorFn: (m) => m.isBoss,
    header: 'Boss',
    meta: {
      filter: 'boolean',
      booleanLabels: { trueLabel: 'Boss', falseLabel: 'Non-boss' },
      icon: Crown,
    },
    cell: ({ row }) =>
      row.original.isBoss ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
          <Crown className="h-3 w-3" />
          Boss
        </span>
      ) : (
        '—'
      ),
  },
  {
    id: 'id',
    accessorFn: (m) => m.id,
    header: 'ID',
    // IDs are integers in the DB but the user-facing search is "does the
    // ID contain these digits" — range filters never apply. SQLite's LIKE
    // auto-coerces the integer to text for the match.
    meta: {
      filter: 'string',
      icon: Hash,
      card: { label: 'ID', render: (row) => row.id },
    },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = ['icon', 'name', 'level', 'hp', 'exp'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'level', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

export function mobileCard(row: MobRecord) {
  const stats: ListCardStat[] = [];
  if (row.level !== null) stats.push({ label: 'Lvl', value: row.level });
  if (row.hp !== null) stats.push({ label: 'HP', value: row.hp.toLocaleString() });
  if (row.exp !== null) stats.push({ label: 'EXP', value: <ExpValue exp={row.exp} /> });
  if (row.mp) stats.push({ label: 'MP', value: row.mp.toLocaleString() });
  return (
    <ListCardBody
      entity="mob"
      id={row.id}
      name={row.name}
      badge={
        row.isBoss ? (
          <Chip tone="gold" icon={Crown}>
            Boss
          </Chip>
        ) : undefined
      }
      stats={stats}
    />
  );
}
