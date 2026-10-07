import { Link } from 'react-router-dom';
import { Crown, Skull } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { getDbClient, type MobRecord } from '@/db';
import { routeForEntity } from '@/lib/entityRoutes';
import { elementsByStatus } from '@scrolled/game-db/domain/mobElements';
import { ElementAffinities } from './ElementAffinities';
import { ELEMENT_AFFINITY_STATUSES } from '@/components/entity-display/mobElementsDisplay';
import { Num } from './shared';
import { flagField } from './flags';
import type { TooltipEntityConfig, TooltipField } from './types';

type MobField = TooltipField<MobRecord, Record<string, never>>;

const fields: MobField[] = [
  flagField<MobRecord>('isBoss', {
    label: 'Boss',
    whenTrue: 'Boss',
    whenFalse: 'Normal',
    defaultMode: 'whenPresent',
    trueClassName: 'bg-[image:var(--gradient-gold)] text-[color:var(--gold-fg)]',
    trueIcon: <Crown className="h-3 w-3" />,
  }),
  {
    key: 'level',
    label: 'Level',
    short: 'Lvl',
    tone: 148,
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'always',
    isPresent: ({ record }) => record.level !== null,
    render: ({ record }) => <Num>{record.level ?? '—'}</Num>,
  },
  {
    key: 'hp',
    label: 'HP',
    short: 'HP',
    tone: 22,
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'always',
    isPresent: ({ record }) => record.hp !== null,
    render: ({ record }) => <Num>{record.hp?.toLocaleString() ?? '—'}</Num>,
  },
  {
    key: 'exp',
    label: 'EXP',
    short: 'EXP',
    tone: 80,
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'always',
    isPresent: ({ record }) => record.exp !== null,
    render: ({ record }) => <Num>{record.exp?.toLocaleString() ?? '—'}</Num>,
  },
  {
    key: 'expHp',
    label: 'EXP / HP',
    short: 'EXP/HP',
    tone: 80,
    hint: 'Experience per point of HP (EXP ÷ HP).',
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'never',
    isPresent: ({ record }) => record.exp !== null && record.hp !== null && record.hp > 0,
    render: ({ record }) => (
      <Num>
        {record.exp !== null && record.hp
          ? (record.exp / record.hp).toLocaleString(undefined, { maximumFractionDigits: 3 })
          : '—'}
      </Num>
    ),
  },
  {
    key: 'mp',
    label: 'MP',
    short: 'MP',
    tone: 240,
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'never',
    isPresent: ({ record }) => record.mp !== null && record.mp !== 0,
    render: ({ record }) => <Num>{record.mp?.toLocaleString() ?? '—'}</Num>,
  },
  {
    key: 'elements',
    label: 'Element resistances',
    hint: 'Immune / strong / weak element groups.',
    zone: 'body',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) =>
      ELEMENT_AFFINITY_STATUSES.some((status) => elementsByStatus(record.elementAttack, status).length > 0),
    render: ({ record }) => <ElementAffinities element={record.elementAttack} />,
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
      className="hover:text-primary block truncate hover:underline"
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
