import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { getDbClient, type SkillRecord } from '@/db';
import { routeForEntity } from '@/lib/entityRoutes';
import { useJobsMap } from '@/hooks/useJobs';
import { decodeRequiredWeapon, decodeSkillElement } from '@scrolled/game-db/domain/skillElements';
import { Mono } from './shared';
import type { TooltipEntityConfig, TooltipField } from './types';

interface SkillExtra {
  jobsMap: Map<number, string>;
}

type SkillField = TooltipField<SkillRecord, SkillExtra>;

const fields: SkillField[] = [
  {
    key: 'job',
    label: 'Job',
    short: 'Job',
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'always',
    isPresent: () => true,
    render: ({ record, extra, showIds }) => {
      const jobName = extra.jobsMap.get(record.jobId);
      if (!jobName) return <span className="font-mono">{record.jobId}</span>;
      if (!showIds) return <>{jobName}</>;
      return (
        <>
          {jobName} <span className="text-muted-foreground font-mono">{record.jobId}</span>
        </>
      );
    },
  },
  {
    key: 'maxLevel',
    label: 'Max level',
    short: 'Max',
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'always',
    isPresent: ({ record }) => record.maxLevel !== null,
    render: ({ record }) => <Mono>{record.maxLevel ?? '—'}</Mono>,
  },
  {
    key: 'element',
    label: 'Element',
    short: 'Elem',
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!(decodeSkillElement(record.element) ?? record.element),
    render: ({ record }) => (
      <span className="text-foreground">
        {decodeSkillElement(record.element) ?? record.element ?? '—'}
      </span>
    ),
  },
  {
    key: 'masterLevel',
    label: 'Master level',
    short: 'Master',
    zone: 'meta',
    metaVariant: 'gridCell',
    defaultMode: 'never',
    isPresent: ({ record }) => record.masterLevel !== null,
    render: ({ record }) => <Mono>{record.masterLevel ?? '—'}</Mono>,
  },
  {
    key: 'requiredWeapon',
    label: 'Required weapon',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!decodeRequiredWeapon(record.requiredWeapon),
    render: ({ record }) => {
      const weapon = decodeRequiredWeapon(record.requiredWeapon);
      return (
        <p className="text-muted-foreground truncate text-[11px]">
          {weapon ? `Needs ${weapon}` : 'No weapon requirement'}
        </p>
      );
    },
  },
  {
    key: 'description',
    label: 'Description',
    zone: 'body',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.description?.trim(),
    render: ({ record }) => (
      <p className="text-muted-foreground line-clamp-3 text-[11px]">{record.description}</p>
    ),
  },
];

export const skillConfig: TooltipEntityConfig<SkillRecord, SkillExtra> = {
  entity: 'skill',
  idPrefix: 'Skill',
  fetch: (id) => getDbClient().getSkill(id),
  queryKey: (id) => ['db', 'skill', id],
  useExtraData: () => ({ jobsMap: useJobsMap() }),
  renderIcon: (record, id) => (
    <EntityIcon
      entity="skill"
      id={id}
      size={48}
      placeholder={Sparkles}
      alt={record.name ?? `Skill ${id}`}
    />
  ),
  renderName: (record, id) => (
    <Link
      to={routeForEntity('skill', id)}
      className="hover:text-primary block truncate text-sm font-semibold hover:underline"
    >
      {record.name ?? `Skill ${id}`}
    </Link>
  ),
  getSampleId: () => getDbClient().listSkills({ limit: 1 }).then((r) => r.rows[0]?.id ?? null),
  fields,
};
