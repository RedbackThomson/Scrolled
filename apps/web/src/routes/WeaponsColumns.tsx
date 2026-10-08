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
  Users,
} from 'lucide-react';
import { EquipLink } from '@/components/entity-links';
import type { EquipRecord } from '@/db';
import { ABILITY_STAT_FIELDS } from '@scrolled/game-db/domain/abilityStats';
import { labelForEquipType } from '@scrolled/game-db/domain/equipTypes';
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

/** A right-aligned, number-filterable column for one numeric equip stat.
 *  Each stat carries a `meta.card` config so toggling it on also surfaces
 *  the value as a labeled row on the mobile card. */
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
    id: 'equipType',
    accessorFn: (e) => e.equipType,
    header: 'Type',
    meta: { filter: 'enum', icon: Sword },
    cell: ({ row }) => (row.original.equipType ? labelForEquipType(row.original.equipType) : '—'),
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

export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'requiredLevel', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

/**
 * Magic-attack weapons used by INT classes — defaults should surface
 * `magicAttack` instead of `attack`. Listed by equip-type slug so the
 * route can pick the column set without case-by-case branches.
 */
const MAGIC_WEAPON_TYPES = new Set(['wand', 'staff']);

const PHYSICAL_DEFAULT = [
  'icon',
  'name',
  'equipType',
  'cash',
  'requiredLevel',
  'requiredJob',
  'attack',
  'requiredDex',
  'upgradeSlots',
] as const;

const MAGIC_DEFAULT = [
  'icon',
  'name',
  'equipType',
  'cash',
  'requiredLevel',
  'requiredJob',
  'magicAttack',
  'upgradeSlots',
] as const;

// Cash-shop weapons are cosmetic overlays with no stats, so the default
// columns drop attack/accuracy/slots and just surface the cash badge.
const CASH_DEFAULT = ['icon', 'name', 'equipType', 'cash'] as const;

/**
 * Pick the default visible-column set based on the active weapon-type
 * filter. When no single type is pinned (or it's an unknown slug), the
 * physical default is fine — it still surfaces M.Atk via column toggle.
 */
export function defaultVisibleForType(type: string | null): readonly string[] {
  if (type === 'cash-weapon') return CASH_DEFAULT;
  if (type && MAGIC_WEAPON_TYPES.has(type)) return MAGIC_DEFAULT;
  return PHYSICAL_DEFAULT;
}

export function mobileCard(row: EquipRecord) {
  // Magic weapons advertise M.Atk; everything else uses Atk. Cash weapons
  // have neither — the badge is what identifies them.
  const isMagic = row.equipType !== null && MAGIC_WEAPON_TYPES.has(row.equipType);
  const atk = isMagic ? row.magicAttack : row.attack;
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
      subtitle={row.equipType ? labelForEquipType(row.equipType) : undefined}
      stats={equipCardStats(
        row,
        atk === null ? undefined : { label: isMagic ? 'M.Atk' : 'Atk', value: atk, tone: 'attack' },
      )}
      tags={equipCardTags(row)}
    />
  );
}

export const facets: readonly FacetDef[] = [
  { columnId: 'equipType', label: 'Type', hue: 235 },
  { columnId: 'requiredJob', label: 'Class', hue: 300 },
  {
    columnId: 'requiredLevel',
    label: 'Req Lvl',
    hue: 148,
    level: true,
  },
  { columnId: 'attack', label: 'Atk', hue: 185 },
  { columnId: 'upgradeSlots', label: 'Slots', hue: 260 },
];
