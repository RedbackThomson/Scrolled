import type { ColumnDef } from '@tanstack/react-table';
import { Briefcase, Flame, Gauge, Hash, Swords } from 'lucide-react';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { SkillLink } from '@/components/entity-links';
import type { SkillRecord } from '@/db';
import { decodeRequiredWeapon, decodeSkillElement } from '@scrolled/game-db/domain/skillElements';
import { useJobsMap } from '@/hooks/useJobs';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { ListCardBody } from '@/components/data-table/ListCardBody';
import type { ListCardStat } from '@/components/data-table/listCardLayout';

export const columns: ColumnDef<SkillRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityAvatar
        entity="skill"
        id={row.original.id}
        size={36}
        alt={row.original.name ?? undefined}
      />
    ),
  },
  {
    id: 'name',
    accessorFn: (s) => s.name ?? '',
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => {
      const s = row.original;
      const label = s.name ?? `Skill ${s.id}`;
      return (
        <SkillLink id={s.id} className="inline-flex items-center gap-2">
          <span className={s.name ? 'font-semibold' : 'text-muted-foreground italic'}>{label}</span>
        </SkillLink>
      );
    },
  },
  {
    id: 'jobId',
    accessorFn: (s) => s.jobId,
    header: 'Job',
    meta: { filter: 'enum', icon: Briefcase },
    cell: ({ row }) => <JobCell jobId={row.original.jobId} />,
  },
  {
    id: 'maxLevel',
    accessorFn: (s) => s.maxLevel,
    header: 'Max level',
    meta: { filter: 'number', icon: Gauge },
    cell: ({ row }) => row.original.maxLevel ?? '—',
  },
  {
    id: 'element',
    accessorFn: (s) => s.element,
    header: 'Element',
    meta: { filter: 'string', icon: Flame },
    cell: ({ row }) => {
      const decoded = decodeSkillElement(row.original.element);
      return decoded ?? row.original.element ?? '—';
    },
  },
  {
    id: 'requiredWeapon',
    accessorFn: (s) => s.requiredWeapon,
    header: 'Weapon',
    meta: { filter: 'string', icon: Swords },
    cell: ({ row }) => {
      const decoded = decodeRequiredWeapon(row.original.requiredWeapon);
      return decoded ?? row.original.requiredWeapon ?? '—';
    },
  },
  {
    id: 'id',
    accessorFn: (s) => s.id,
    header: 'ID',
    meta: {
      filter: 'string',
      icon: Hash,
      card: { label: 'ID', render: (row) => row.id },
    },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

function JobCell({ jobId }: { jobId: number }) {
  const jobs = useJobsMap();
  const showIds = useShowEntityIds((s) => s.enabled);
  const name = jobs.get(jobId);
  if (!name) {
    // Falls back to the integer when the jobs table hasn't loaded yet
    // (first paint before the React-Query fetch resolves, or a partial
    // dataset without Skill.wz / String.wz/Job.img). Always shown in
    // that case because the alternative would be an empty cell.
    return <span className="font-mono text-xs">{jobId}</span>;
  }
  if (!showIds) {
    return <span>{name}</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span>{name}</span>
      <span className="text-muted-foreground font-mono text-xs">{jobId}</span>
    </span>
  );
}

export const defaultVisible = ['icon', 'name', 'jobId', 'maxLevel'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'name', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

// Wrapped in a component so the meta line can resolve the job id through
// `useJobsMap` — `mobileCard` itself is a plain `(row) => ReactNode`
// callback, but each row renders its own sub-tree where hooks are valid.
export function mobileCard(row: SkillRecord) {
  return <SkillMobileCard row={row} />;
}

function SkillMobileCard({ row }: { row: SkillRecord }) {
  const jobs = useJobsMap();
  const showIds = useShowEntityIds((s) => s.enabled);
  const jobName = jobs.get(row.jobId);
  const stats: ListCardStat[] = [];
  if (row.maxLevel !== null) stats.push({ label: 'Max', value: row.maxLevel });
  const element = decodeSkillElement(row.element);
  if (element) stats.push({ label: 'Element', value: element });
  const weapon = decodeRequiredWeapon(row.requiredWeapon);
  if (weapon) stats.push({ label: 'Weapon', value: weapon });
  const job = jobName ? (showIds ? `${jobName} (${row.jobId})` : jobName) : `Job ${row.jobId}`;
  return (
    <ListCardBody
      entity="skill"
      id={row.id}
      alt={row.name ?? undefined}
      name={
        row.name ?? <span className="text-muted-foreground font-medium italic">Skill {row.id}</span>
      }
      subtitle={job}
      stats={stats}
    />
  );
}
