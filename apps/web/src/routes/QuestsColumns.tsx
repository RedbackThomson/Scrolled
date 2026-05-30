import type { ColumnDef } from '@tanstack/react-table';
import {
  Coins,
  Folder,
  Gauge,
  Hash,
  RotateCw,
  ScrollText,
  Sparkles,
  Star,
} from 'lucide-react';
import { QuestLink } from '@/components/entity-links';
import type { QuestRecord } from '@/db';
import { formatDurationSeconds } from '@/lib/duration';

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
  const meta: string[] = [];
  if (row.parent) meta.push(row.parent);
  if (row.requiredLevel !== null) meta.push(`Lvl ${row.requiredLevel}`);
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
