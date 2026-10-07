import type { ColumnDef } from '@tanstack/react-table';
import {
  BadgeDollarSign,
  Gauge,
  Hash,
  Heart,
  type LucideIcon,
  Shield,
  Sparkles,
  Sword,
  Tag,
  Users,
} from 'lucide-react';
import { EquipLink } from '@/components/entity-links';
import type { EquipRecord } from '@/db';
import { ABILITY_STAT_FIELDS } from '@scrolled/game-db/domain/abilityStats';
import { labelForEquipSlot } from '@scrolled/game-db/domain/equipTypes';
import { isAnyClass, parseEquipReqJob } from '@scrolled/game-db/domain/equipJobs';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { Chip } from '@scrolled/design';
import { ListCardBody } from '@/components/data-table/ListCardBody';
import { equipCardStats, equipCardTags } from './equipCardParts';
import type { FacetDef } from '@/components/data-table/presets';

const num = (v: number | null) => (v === null ? '—' : v.toLocaleString());

/** Keys of `EquipRecord` whose value is a nullable number. */
type NumericEquipKey = {
  [K in keyof EquipRecord]: EquipRecord[K] extends number | null ? K : never;
}[keyof EquipRecord];

/** A number-filterable column for one numeric equip stat. Every stat
 *  column comes with a `meta.card` config so that toggling the column on
 *  also surfaces it on mobile cards. */
const statColumn = (
  id: NumericEquipKey,
  header: string,
  icon?: LucideIcon,
  /** The headline offensive stat, set in bold so it scans first. */
  strong = false,
): ColumnDef<EquipRecord> => ({
  id,
  accessorFn: (e) => e[id],
  header,
  meta: {
    filter: 'number',
    icon,
    card: { label: header, render: (row) => num(row[id]) },
  },
  cell: ({ row }) =>
    strong ? (
      <span className="font-bold tabular-nums">{num(row.original[id])}</span>
    ) : (
      num(row.original[id])
    ),
});

export const columns: ColumnDef<EquipRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityAvatar entity="equip" id={row.original.id} size={36} alt={row.original.name} />
    ),
  },
  {
    id: 'name',
    accessorFn: (e) => e.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <EquipLink id={row.original.id} className="font-semibold">
        {row.original.name}
      </EquipLink>
    ),
  },
  {
    id: 'slot',
    accessorFn: (e) => e.slot,
    header: 'Slot',
    meta: { filter: 'enum', icon: Tag },
    cell: ({ row }) => (
      <span>{row.original.slot ? labelForEquipSlot(row.original.slot) : '—'}</span>
    ),
  },
  {
    id: 'cash',
    accessorFn: (e) => e.cash,
    header: 'Cash',
    meta: {
      filter: 'boolean',
      booleanLabels: { trueLabel: 'Cash', falseLabel: 'Regular' },
      icon: BadgeDollarSign,
    },
    cell: ({ row }) =>
      row.original.cash ? (
        <Chip tone="hue" hue={330}>
          Cash
        </Chip>
      ) : (
        <span className="text-muted-foreground text-xs">Regular</span>
      ),
  },
  {
    id: 'requiredLevel',
    accessorFn: (e) => e.requiredLevel,
    header: 'Req Lvl',
    meta: { filter: 'number', icon: Gauge },
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
    meta: { filter: 'enum', icon: Users },
    cell: ({ row }) => {
      const jobs = parseEquipReqJob(row.original.requiredJob);
      if (isAnyClass(jobs)) {
        return <span className="text-muted-foreground text-xs">Any</span>;
      }
      return <span className="text-xs">{jobs.join(', ')}</span>;
    },
  },
  statColumn('attack', 'Atk', Sword, true),
  statColumn('magicAttack', 'M.Atk', Sword, true),
  ...ABILITY_STAT_FIELDS.map((s) => statColumn(s.inc, s.label)),
  statColumn('incHp', 'HP', Heart),
  statColumn('incMp', 'MP', Sparkles),
  statColumn('defense', 'Def', Shield),
  statColumn('magicDefense', 'M.Def', Shield),
  statColumn('accuracy', 'Acc'),
  statColumn('avoidability', 'Avoid'),
  statColumn('incSpeed', 'Speed'),
  statColumn('incJump', 'Jump'),
  {
    id: 'upgradeSlots',
    accessorFn: (e) => e.upgradeSlots,
    header: 'Slots',
    meta: { filter: 'number' },
    cell: ({ row }) =>
      row.original.upgradeSlots === null ? '—' : <Chip>{row.original.upgradeSlots}</Chip>,
  },
  {
    id: 'id',
    accessorFn: (e) => e.id,
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
  return (
    <ListCardBody
      entity="equip"
      id={row.id}
      name={row.name}
      badge={
        row.cash ? (
          <Chip tone="hue" hue={330}>
            Cash
          </Chip>
        ) : undefined
      }
      subtitle={row.slot ? labelForEquipSlot(row.slot) : undefined}
      stats={equipCardStats(row)}
      tags={equipCardTags(row)}
    />
  );
}

export const facets: readonly FacetDef[] = [
  { columnId: 'slot', label: 'Slot', hue: 235 },
  { columnId: 'requiredJob', label: 'Class', hue: 300 },
  {
    columnId: 'requiredLevel',
    label: 'Req Lvl',
    hue: 148,
    aroundMyLevel: true,
    quickRanges: [{ label: 'Starter (0–10)', value: [0, 10] }],
  },
  { columnId: 'upgradeSlots', label: 'Slots', hue: 185 },
];
