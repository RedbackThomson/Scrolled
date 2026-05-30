import type { ColumnDef } from '@tanstack/react-table';
import { Briefcase, EyeOff, Flame, Gauge, Hash, Sparkles, Swords } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { SkillLink } from '@/components/entity-links';
import type { SkillRecord } from '@/db';
import { decodeRequiredWeapon, decodeSkillElement } from '@/domain/skillElements';
import { useJobsMap } from '@/hooks/useJobs';
import { useShowEntityIds } from '@/stores/showEntityIds';

export const columns: ColumnDef<SkillRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityIcon
        entity="skill"
        id={row.original.id}
        size={28}
        placeholder={Sparkles}
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
          <span className={s.name ? 'font-medium' : 'text-muted-foreground italic'}>{label}</span>
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
    id: 'hidden',
    accessorFn: (s) => s.hidden,
    header: 'Hidden',
    meta: {
      filter: 'boolean',
      booleanLabels: { trueLabel: 'Hidden', falseLabel: 'Visible' },
      icon: EyeOff,
    },
    cell: ({ row }) =>
      row.original.hidden ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-zinc-500/15 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
          <EyeOff className="h-3 w-3" />
          Hidden
        </span>
      ) : (
        '—'
      ),
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
  const meta: string[] = [];
  if (row.maxLevel !== null) meta.push(`Max ${row.maxLevel}`);
  const element = decodeSkillElement(row.element);
  if (element) meta.push(element);
  const weapon = decodeRequiredWeapon(row.requiredWeapon);
  if (weapon) meta.push(weapon);
  if (jobName) {
    meta.push(showIds ? `${jobName} (${row.jobId})` : jobName);
  } else {
    meta.push(`Job ${row.jobId}`);
  }
  const label = row.name ?? `Skill ${row.id}`;
  return (
    <div className="flex items-center gap-3">
      <EntityIcon
        entity="skill"
        id={row.id}
        size={40}
        placeholder={Sparkles}
        alt={row.name ?? undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={row.name ? 'truncate font-medium' : 'text-muted-foreground truncate italic'}
          >
            {label}
          </span>
        </div>
        <div className="text-muted-foreground truncate text-xs">{meta.join(' · ')}</div>
      </div>
    </div>
  );
}
