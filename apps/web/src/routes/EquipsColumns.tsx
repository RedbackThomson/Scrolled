import type { ColumnDef } from '@tanstack/react-table';
import { ItemIcon } from '@/components/entity-display/ItemIcon';
import { EquipLink } from '@/components/entity-links';
import type { EquipRecord } from '@/db';
import { ABILITY_STAT_FIELDS } from '@/domain/abilityStats';
import { labelForEquipSlot } from '@/domain/equipTypes';
import { isAnyClass, parseReqJob } from '@/domain/equipJobs';

const num = (v: number | null) => (v === null ? '—' : v.toLocaleString());

/** Keys of `EquipRecord` whose value is a nullable number. */
type NumericEquipKey = {
  [K in keyof EquipRecord]: EquipRecord[K] extends number | null ? K : never;
}[keyof EquipRecord];

/** A number-filterable column for one numeric equip stat. */
const statColumn = (id: NumericEquipKey, header: string): ColumnDef<EquipRecord> => ({
  id,
  accessorFn: (e) => e[id],
  header,
  meta: { filter: 'number' },
  cell: ({ row }) => num(row.original[id]),
});

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
    cell: ({ row }) => (
      <span>{row.original.slot ? labelForEquipSlot(row.original.slot) : '—'}</span>
    ),
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
    header: 'Req Lvl',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.requiredLevel ?? '—',
  },
  ...ABILITY_STAT_FIELDS.map((s) => statColumn(s.required, `Req ${s.label}`)),
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
  statColumn('attack', 'Atk'),
  statColumn('magicAttack', 'M.Atk'),
  ...ABILITY_STAT_FIELDS.map((s) => statColumn(s.inc, s.label)),
  statColumn('incHp', 'HP'),
  statColumn('incMp', 'MP'),
  statColumn('defense', 'Def'),
  statColumn('magicDefense', 'M.Def'),
  statColumn('accuracy', 'Acc'),
  statColumn('avoidability', 'Avoid'),
  statColumn('incSpeed', 'Speed'),
  statColumn('incJump', 'Jump'),
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
    meta: { filter: 'string' },
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
  'upgradeSlots',
] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

export function mobileCard(row: EquipRecord) {
  const meta: string[] = [];
  if (row.slot) meta.push(labelForEquipSlot(row.slot));
  if (row.requiredLevel !== null) meta.push(`Lvl ${row.requiredLevel}`);
  return (
    <div className="flex items-center gap-3">
      <ItemIcon entity="equip" id={row.id} size={40} alt={row.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{row.name}</span>
          {row.cash && (
            <span className="inline-flex shrink-0 items-center rounded bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-medium text-pink-700 dark:text-pink-300">
              Cash
            </span>
          )}
        </div>
        {meta.length > 0 && (
          <div className="text-muted-foreground truncate text-xs">{meta.join(' · ')}</div>
        )}
      </div>
    </div>
  );
}
