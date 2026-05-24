import type { ColumnDef } from '@tanstack/react-table';
import { ItemIcon } from '@/components/ItemIcon';
import { EquipLink } from '@/components/entity-links';
import type { EquipRecord } from '@/db';
import { labelForEquipSlot } from '@/lib/equipTypes';
import { isAnyClass, parseReqJob } from '@/lib/equipJobs';

const num = (v: number | null) => (v === null ? '—' : v.toLocaleString());

export const columns: ColumnDef<EquipRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <ItemIcon entity="equip" id={row.original.id} size={28} alt={row.original.name} />
    ),
  },
  {
    id: 'name',
    accessorFn: (e) => e.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <EquipLink id={row.original.id} className="font-medium">
        {row.original.name}
      </EquipLink>
    ),
  },
  {
    id: 'slot',
    accessorFn: (e) => e.slot,
    header: 'Slot',
    meta: { filter: 'enum' },
    cell: ({ row }) => <span>{row.original.slot ? labelForEquipSlot(row.original.slot) : '—'}</span>,
  },
  {
    id: 'cash',
    accessorFn: (e) => e.cash,
    header: 'Cash',
    meta: { filter: 'boolean', booleanLabels: { trueLabel: 'Cash', falseLabel: 'Regular' } },
    cell: ({ row }) =>
      row.original.cash ? (
        <span className="inline-flex items-center rounded bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-medium text-pink-700 dark:text-pink-300">
          Cash
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">Regular</span>
      ),
  },
  {
    id: 'requiredLevel',
    accessorFn: (e) => e.requiredLevel,
    header: 'Req Lv',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.requiredLevel ?? '—',
  },
  {
    id: 'requiredJob',
    accessorFn: (e) => e.requiredJob,
    header: 'Class',
    // Raw bitfield ordering isn't meaningful — disable sort so the header
    // click toggles only when there's a useful order to sort by.
    enableSorting: false,
    meta: { filter: 'enum' },
    cell: ({ row }) => {
      const jobs = parseReqJob(row.original.requiredJob);
      if (isAnyClass(jobs)) {
        return <span className="text-muted-foreground text-xs">Any</span>;
      }
      return <span className="text-xs">{jobs.join(', ')}</span>;
    },
  },
  {
    id: 'attack',
    accessorFn: (e) => e.attack,
    header: 'Atk',
    meta: { filter: 'number' },
    cell: ({ row }) => num(row.original.attack),
  },
  {
    id: 'magicAttack',
    accessorFn: (e) => e.magicAttack,
    header: 'M.Atk',
    meta: { filter: 'number' },
    cell: ({ row }) => num(row.original.magicAttack),
  },
  {
    id: 'defense',
    accessorFn: (e) => e.defense,
    header: 'Def',
    meta: { filter: 'number' },
    cell: ({ row }) => num(row.original.defense),
  },
  {
    id: 'magicDefense',
    accessorFn: (e) => e.magicDefense,
    header: 'M.Def',
    meta: { filter: 'number' },
    cell: ({ row }) => num(row.original.magicDefense),
  },
  {
    id: 'accuracy',
    accessorFn: (e) => e.accuracy,
    header: 'Acc',
    meta: { filter: 'number' },
    cell: ({ row }) => num(row.original.accuracy),
  },
  {
    id: 'avoidability',
    accessorFn: (e) => e.avoidability,
    header: 'Avoid',
    meta: { filter: 'number' },
    cell: ({ row }) => num(row.original.avoidability),
  },
  {
    id: 'upgradeSlots',
    accessorFn: (e) => e.upgradeSlots,
    header: 'Slots',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.upgradeSlots ?? '—',
  },
  {
    id: 'id',
    accessorFn: (e) => e.id,
    header: 'ID',
    meta: { filter: 'number' },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = [
  'icon',
  'name',
  'slot',
  'cash',
  'requiredLevel',
  'requiredJob',
  'defense',
  'magicDefense',
  'upgradeSlots',
] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};
