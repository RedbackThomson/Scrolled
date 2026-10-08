import type { ColumnDef } from '@tanstack/react-table';
import { Coins, Folder, Gauge, Hash, RotateCw, Sparkles, Star } from 'lucide-react';
import { QuestLink } from '@/components/entity-links';
import type { QuestRecord } from '@/db';
import { formatDurationSeconds } from '@/lib/duration';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { ListCardBody } from '@/components/data-table/ListCardBody';
import type { ListCardStat } from '@/components/data-table/listCardLayout';
import { ExpValue } from '@/components/entity-display/ExpValue';
import type { FacetDef } from '@/components/data-table/presets';

const numberFormatter = new Intl.NumberFormat();

function renderRewardCell(value: number | null) {
  if (value === null || value === 0) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums">{numberFormatter.format(value)}</span>;
}

export const columns: ColumnDef<QuestRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => <EntityAvatar entity="quest" id={row.original.id} size={36} />,
  },
  {
    id: 'name',
    accessorFn: (q) => q.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <QuestLink id={row.original.id} className="font-semibold">
        {row.original.name}
      </QuestLink>
    ),
  },
  {
    id: 'parent',
    accessorFn: (q) => q.parent,
    header: 'Area',
    meta: { filter: 'enum', icon: Folder },
    cell: ({ row }) => row.original.parent ?? '—',
  },
  {
    id: 'requiredLevel',
    accessorFn: (q) => q.requiredLevel,
    header: 'Req Lvl',
    meta: { filter: 'number', icon: Gauge },
    cell: ({ row }) => row.original.requiredLevel ?? '—',
  },
  {
    id: 'rewardExp',
    accessorFn: (q) => q.rewardExp,
    header: 'Reward EXP',
    meta: { filter: 'number', icon: Sparkles },
    cell: ({ row }) => renderRewardCell(row.original.rewardExp),
  },
  {
    id: 'rewardMeso',
    accessorFn: (q) => q.rewardMeso,
    header: 'Reward Mesos',
    meta: { filter: 'number', icon: Coins },
    cell: ({ row }) => renderRewardCell(row.original.rewardMeso),
  },
  {
    id: 'rewardFame',
    accessorFn: (q) => q.rewardFame,
    header: 'Reward Fame',
    meta: { filter: 'number', icon: Star },
    cell: ({ row }) => renderRewardCell(row.original.rewardFame),
  },
  {
    id: 'repeatable',
    accessorFn: (q) => q.repeatWait,
    header: 'Repeatable',
    enableSorting: false,
    meta: {
      filter: 'boolean',
      booleanLabels: { trueLabel: 'Repeatable', falseLabel: 'Not Repeatable' },
      icon: RotateCw,
      card: {
        label: 'Repeatable',
        render: (row) =>
          row.repeatWait !== null ? `every ${formatDurationSeconds(row.repeatWait)}` : '—',
      },
    },
    cell: ({ row }) =>
      row.original.repeatWait !== null ? (
        <span className="text-muted-foreground text-xs">
          every {formatDurationSeconds(row.original.repeatWait)}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'id',
    accessorFn: (q) => q.id,
    header: 'ID',
    meta: {
      filter: 'string',
      icon: Hash,
      card: { label: 'ID', render: (row) => row.id },
    },
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
  const stats: ListCardStat[] = [];
  if (row.requiredLevel !== null) stats.push({ label: 'Req Lv', value: row.requiredLevel });
  if (row.rewardExp) stats.push({ label: 'EXP', value: <ExpValue exp={row.rewardExp} /> });
  if (row.rewardMeso) stats.push({ label: 'Mesos', value: numberFormatter.format(row.rewardMeso) });
  return (
    <ListCardBody
      entity="quest"
      id={row.id}
      name={row.name}
      subtitle={row.parent ?? undefined}
      stats={stats}
    />
  );
}

export const facets: readonly FacetDef[] = [
  { columnId: 'parent', label: 'Area', hue: 235 },
  { columnId: 'requiredLevel', label: 'Level', hue: 148, level: true },
  { columnId: 'repeatable', label: 'Repeatable', hue: 185 },
  { columnId: 'rewardExp', label: 'Reward EXP', hue: 260 },
];
