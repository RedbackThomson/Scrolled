import { Link } from 'react-router-dom';
import { Crown, Skull } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { getDbClient, type MobRecord } from '@/db';
import { routeForEntity } from '@/lib/entityRoutes';
import { elementsByStatus } from '@scrolled/game-db/domain/mobElements';
import {
  ELEMENT_GROUP_LABELS,
  ELEMENT_STATUS_CLASSES,
} from '@/components/entity-display/mobElementsDisplay';
import { Mono } from './shared';
import { flagField } from './flags';
import type { TooltipEntityConfig, TooltipField } from './types';

const HOVER_CARD_STATUSES = ['immune', 'resistant', 'weak'] as const;

type MobField = TooltipField<MobRecord, Record<string, never>>;

const fields: MobField[] = [
  flagField<MobRecord>('isBoss', {
    label: 'Boss',
    whenTrue: 'Boss',
    whenFalse: 'Normal',
    defaultMode: 'whenPresent',
    trueClassName: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    trueIcon: <Crown className="h-3 w-3" />,
  }),
  {
    key: 'level',
    label: 'Level',
    short: 'Lvl',
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'always',
    isPresent: ({ record }) => record.level !== null,
    render: ({ record }) => <Mono>{record.level ?? '—'}</Mono>,
  },
  {
    key: 'hp',
    label: 'HP',
    short: 'HP',
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'always',
    isPresent: ({ record }) => record.hp !== null,
    render: ({ record }) => <Mono>{record.hp?.toLocaleString() ?? '—'}</Mono>,
  },
  {
    key: 'exp',
    label: 'EXP',
    short: 'EXP',
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'always',
    isPresent: ({ record }) => record.exp !== null,
    render: ({ record }) => <Mono>{record.exp?.toLocaleString() ?? '—'}</Mono>,
  },
  {
    key: 'mp',
    label: 'MP',
    short: 'MP',
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'never',
    isPresent: ({ record }) => record.mp !== null && record.mp !== 0,
    render: ({ record }) => <Mono>{record.mp?.toLocaleString() ?? '—'}</Mono>,
  },
  {
    key: 'elements',
    label: 'Element resistances',
    hint: 'Immune / strong / weak element groups.',
    zone: 'body',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) =>
      HOVER_CARD_STATUSES.some((status) => elementsByStatus(record.elementAttack, status).length > 0),
    render: ({ record }) => {
      const groups = HOVER_CARD_STATUSES.map((status) => ({
        status,
        names: elementsByStatus(record.elementAttack, status),
      })).filter((g) => g.names.length > 0);
      return (
        <dl className="space-y-0.5 text-[11px]">
          {groups.map(({ status, names }) => (
            <div key={status} className="flex gap-2">
              <dt className="text-muted-foreground shrink-0">{ELEMENT_GROUP_LABELS[status]}</dt>
              <dd className={ELEMENT_STATUS_CLASSES[status]}>{names.join(', ')}</dd>
            </div>
          ))}
        </dl>
      );
    },
  },
];

export const mobConfig: TooltipEntityConfig<MobRecord> = {
  entity: 'mob',
  idPrefix: 'Mob',
  fetch: (id) => getDbClient().getMob(id),
  queryKey: (id) => ['db', 'mob', id],
  renderIcon: (record, id) => (
    <EntityIcon entity="mob" id={id} size={64} placeholder={Skull} alt={record.name} />
  ),
  renderName: (record, id) => (
    <Link
      to={routeForEntity('mob', id)}
      className="hover:text-primary block truncate text-sm font-semibold hover:underline"
    >
      {record.name}
    </Link>
  ),
  getSampleId: () =>
    getDbClient()
      .listMobs({ orderBy: 'level', dir: 'desc', limit: 1 })
      .then((r) => r.rows[0]?.id ?? null),
  fields,
};
