import { ItemIcon } from '@/components/entity-display/ItemIcon';
import { getDbClient, type EquipRecord } from '@/db';
import { labelForEquipSlot, labelForEquipType } from '@scrolled/game-db/domain/equipTypes';
import { formatEquipJobs, isAnyClass, parseEquipReqJob } from '@scrolled/game-db/domain/equipJobs';
import { Mono } from './shared';
import { flagField } from './flags';
import type { TooltipEntityConfig, TooltipField } from './types';

type EquipField = TooltipField<EquipRecord, Record<string, never>>;

const stat = (
  key: keyof EquipRecord,
  label: string,
  short: string,
  defaultMode: EquipField['defaultMode'],
): EquipField => ({
  key,
  label,
  short,
  zone: 'meta',
  metaVariant: 'gridCell',
  defaultMode,
  isPresent: ({ record }) => record[key] !== null && record[key] !== 0,
  render: ({ record }) => <Mono>{(record[key] as number | null) ?? '—'}</Mono>,
});

const fields: EquipField[] = [
  {
    key: 'type',
    label: 'Type / slot',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!(record.equipType || record.slot),
    render: ({ record }) => (
      <>
        {record.equipType
          ? labelForEquipType(record.equipType)
          : record.slot
            ? labelForEquipSlot(record.slot)
            : '—'}
      </>
    ),
  },
  {
    key: 'requiredLevel',
    label: 'Required level',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => record.requiredLevel !== null,
    render: ({ record }) => <>Req Lvl {record.requiredLevel}</>,
  },
  flagField<EquipRecord>('cash', {
    label: 'Cash shop',
    whenTrue: 'Cash',
    whenFalse: 'Regular',
    defaultMode: 'whenPresent',
    trueClassName: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  }),
  {
    key: 'class',
    label: 'Class restriction',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) =>
      record.requiredJob !== null && !isAnyClass(parseEquipReqJob(record.requiredJob)),
    render: ({ record }) => (
      <div className="text-muted-foreground text-[11px]">
        Class: <span className="text-foreground">{formatEquipJobs(parseEquipReqJob(record.requiredJob))}</span>
      </div>
    ),
  },
  {
    key: 'description',
    label: 'Description',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.description?.trim(),
    render: ({ record }) => (
      <p className="text-muted-foreground line-clamp-2 text-xs">{record.description}</p>
    ),
  },
  stat('attack', 'Attack', 'Atk', 'whenPresent'),
  stat('magicAttack', 'Magic attack', 'M.Atk', 'whenPresent'),
  stat('defense', 'Defense', 'Def', 'whenPresent'),
  stat('magicDefense', 'Magic defense', 'M.Def', 'whenPresent'),
  stat('accuracy', 'Accuracy', 'Acc', 'never'),
  stat('avoidability', 'Avoidability', 'Avoid', 'never'),
  stat('incStr', 'STR', 'STR', 'never'),
  stat('incDex', 'DEX', 'DEX', 'never'),
  stat('incInt', 'INT', 'INT', 'never'),
  stat('incLuk', 'LUK', 'LUK', 'never'),
  stat('incHp', 'HP', 'HP', 'never'),
  stat('incMp', 'MP', 'MP', 'never'),
  stat('incSpeed', 'Speed', 'Spd', 'never'),
  stat('incJump', 'Jump', 'Jump', 'never'),
  stat('upgradeSlots', 'Upgrade slots', 'Slots', 'never'),
  flagField<EquipRecord>('tradeBlock', {
    label: 'Tradeability',
    whenTrue: 'Untradeable',
    whenFalse: 'Tradeable',
  }),
  flagField<EquipRecord>('only', { label: 'Unique', whenTrue: 'Unique', whenFalse: 'Not unique' }),
  flagField<EquipRecord>('quest', {
    label: 'Quest item',
    whenTrue: 'Quest item',
    whenFalse: 'Not quest item',
  }),
  flagField<EquipRecord>('accountSharable', {
    label: 'Account sharing',
    whenTrue: 'Account shareable',
    whenFalse: 'Not shareable',
  }),
  flagField<EquipRecord>('timeLimited', {
    label: 'Time limit',
    whenTrue: 'Time-limited',
    whenFalse: 'Permanent',
  }),
];

export const equipConfig: TooltipEntityConfig<EquipRecord> = {
  entity: 'equip',
  idPrefix: 'Equip',
  fetch: (id) => getDbClient().getEquip(id),
  queryKey: (id) => ['db', 'equip', id],
  renderIcon: (record, id) => <ItemIcon entity="equip" id={id} size={64} alt={record.name} />,
  renderName: (record) => <div className="truncate text-sm font-semibold">{record.name}</div>,
  getSampleId: () =>
    getDbClient()
      .listEquips({ kind: 'weapon', limit: 1 })
      .then((r) => r.rows[0]?.id ?? null),
  fields,
};
