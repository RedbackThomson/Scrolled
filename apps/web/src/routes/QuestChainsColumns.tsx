import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Folder, GitBranch, GitMerge, Hash, Layers, Network } from 'lucide-react';
import { QuestChainLink, QuestLink } from '@/components/entity-links';
import type { QuestChainListRow } from '@/db';

export const columns: ColumnDef<QuestChainListRow>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: () => <GitBranch className="text-muted-foreground h-5 w-5" />,
  },
  {
    id: 'name',
    accessorFn: (c) => c.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <QuestChainLink id={row.original.id} className="font-medium">
        {row.original.name}
      </QuestChainLink>
    ),
  },
  {
    id: 'size',
    accessorFn: (c) => c.size,
    header: 'Quests',
    meta: { filter: 'number', icon: Network },
    cell: ({ row }) => row.original.size,
  },
  {
    id: 'maxDepth',
    accessorFn: (c) => c.maxDepth,
    header: 'Stage',
    meta: { filter: 'number', icon: Layers },
    cell: ({ row }) => row.original.maxDepth,
  },
  {
    id: 'rootCount',
    accessorFn: (c) => c.rootCount,
    header: 'Starts',
    meta: { filter: 'number', icon: GitMerge },
    cell: ({ row }) => row.original.rootCount,
  },
  {
    id: 'hasCycles',
    accessorFn: (c) => (c.hasCycles ? 1 : 0),
    header: 'Loop',
    meta: { filter: 'boolean', icon: AlertTriangle },
    cell: ({ row }) =>
      row.original.hasCycles ? (
        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertTriangle className="h-3 w-3" />
          Loop
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'parent',
    accessorFn: (c) => c.parent,
    header: 'Area',
    meta: { filter: 'enum', icon: Folder },
    cell: ({ row }) => row.original.parent ?? '—',
  },
  {
    id: 'starts',
    header: 'Starts with',
    enableSorting: false,
    cell: ({ row }) => {
      const preview = row.original.preview;
      if (preview.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-xs">
          {preview.map((q, i) => (
            <span key={q.id} className="inline-flex items-center gap-1">
              <QuestLink id={q.id} className="hover:underline">
                {q.name}
              </QuestLink>
              {i < preview.length - 1 && <span aria-hidden>→</span>}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    id: 'id',
    accessorFn: (c) => c.id,
    header: 'ID',
    meta: {
      filter: 'string',
      icon: Hash,
      card: { label: 'ID', render: (row) => row.id },
    },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = [
  'icon',
  'name',
  'size',
  'maxDepth',
  'rootCount',
  'hasCycles',
  'parent',
  'starts',
] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'size', dir: 'desc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

export function mobileCard(row: QuestChainListRow) {
  const meta: string[] = [];
  meta.push(`${row.size} quests`);
  if (row.maxDepth > 0) meta.push(`${row.maxDepth} stages`);
  if (row.rootCount > 1) meta.push(`${row.rootCount} starts`);
  if (row.hasCycles) meta.push('loop');
  if (row.parent) meta.push(row.parent);
  return (
    <div className="flex items-center gap-3">
      <GitBranch className="text-muted-foreground h-8 w-8 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{row.name}</div>
        <div className="text-muted-foreground truncate text-xs">{meta.join(' · ')}</div>
      </div>
    </div>
  );
}
