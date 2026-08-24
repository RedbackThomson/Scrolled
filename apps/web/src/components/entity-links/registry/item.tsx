import { ItemIcon } from '@/components/entity-display/ItemIcon';
import { getDbClient, type ItemRecord } from '@/db';
import { flagField } from './flags';
import type { TooltipEntityConfig, TooltipField } from './types';

type ItemField = TooltipField<ItemRecord, Record<string, never>>;

const fields: ItemField[] = [
  {
    key: 'category',
    label: 'Category',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.category,
    render: ({ record }) => <span className="capitalize">{record.category}</span>,
  },
  {
    key: 'subcategory',
    label: 'Subcategory',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.subcategory,
    render: ({ record }) => <span className="capitalize">{record.subcategory}</span>,
  },
  {
    key: 'description',
    label: 'Description',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.description?.trim(),
    render: ({ record }) => (
      <p className="text-muted-foreground line-clamp-3 text-xs">{record.description}</p>
    ),
  },
  {
    key: 'requiredLevel',
    label: 'Required level',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => record.requiredLevel !== null,
    render: ({ record }) => <>Req Lvl {record.requiredLevel ?? '—'}</>,
  },
  {
    key: 'price',
    label: 'Price',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => record.price !== null,
    render: ({ record }) => <>{record.price?.toLocaleString() ?? '—'} mesos</>,
  },
  {
    key: 'stackSize',
    label: 'Max stack',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'never',
    isPresent: ({ record }) => record.stackSize !== null,
    render: ({ record }) => <>Max stack {record.stackSize?.toLocaleString() ?? '—'}</>,
  },
  flagField<ItemRecord>('cash', {
    label: 'Cash shop',
    whenTrue: 'Cash',
    whenFalse: 'Regular',
    trueClassName: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  }),
  flagField<ItemRecord>('quest', {
    label: 'Quest item',
    whenTrue: 'Quest item',
    whenFalse: 'Not quest item',
  }),
  flagField<ItemRecord>('only', { label: 'Unique', whenTrue: 'Unique', whenFalse: 'Not unique' }),
  flagField<ItemRecord>('tradeBlock', {
    label: 'Tradeability',
    whenTrue: 'Untradeable',
    whenFalse: 'Tradeable',
  }),
  flagField<ItemRecord>('accountSharable', {
    label: 'Account sharing',
    whenTrue: 'Account shareable',
    whenFalse: 'Not shareable',
  }),
  flagField<ItemRecord>('timeLimited', {
    label: 'Time limit',
    whenTrue: 'Time-limited',
    whenFalse: 'Permanent',
  }),
];

export const itemConfig: TooltipEntityConfig<ItemRecord> = {
  entity: 'item',
  idPrefix: 'Item',
  fetch: (id) => getDbClient().getItem(id),
  queryKey: (id) => ['db', 'item', id],
  renderIcon: (record, id) => <ItemIcon entity="item" id={id} size={64} alt={record.name} />,
  renderName: (record) => <div className="truncate text-sm font-semibold">{record.name}</div>,
  getSampleId: () => getDbClient().listItems({ limit: 1 }).then((r) => r.rows[0]?.id ?? null),
  fields,
};
