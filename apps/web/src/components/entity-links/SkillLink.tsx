import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { HoverPopover } from '@/components/common/HoverPopover';
import { HoverCardSaveFooter } from '@/components/collections';
import { getDbClient } from '@/db';
import { useJobsMap } from '@/hooks/useJobs';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { decodeRequiredWeapon, decodeSkillElement } from '@/domain/skillElements';

interface SkillLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function SkillLink({
  id,
  children,
  className,
  noPreview,
  triggerClassName,
}: SkillLinkProps) {
  const link = (
    <Link to={`/skills/${id}`} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<SkillHoverCard id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}

export function SkillHoverCard({ id }: { id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const showIds = useShowEntityIds((s) => s.enabled);
  const jobsMap = useJobsMap();
  const skillQ = useQuery({
    queryKey: ['db', 'skill', id],
    queryFn: () => client.getSkill(id),
    staleTime: 5 * 60_000,
  });

  if (skillQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!skillQ.data) {
    return <p className="text-muted-foreground text-xs">Skill {id} not found.</p>;
  }
  const s = skillQ.data;
  const displayName = s.name ?? `Skill ${id}`;
  const element = decodeSkillElement(s.element);
  const weapon = decodeRequiredWeapon(s.requiredWeapon);

  return (
    <div className="w-72 max-w-[calc(100vw-1rem)] space-y-1.5">
      <div className="flex gap-3">
        <EntityIcon
          entity="skill"
          id={id}
          size={48}
          placeholder={Sparkles}
          alt={displayName}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            to={`/skills/${id}`}
            className="hover:text-primary block truncate text-sm font-semibold hover:underline"
          >
            {displayName}
          </Link>
          {showIds && (
            <div className="text-muted-foreground font-mono text-[10px]">Skill #{id}</div>
          )}
          <dl className="text-muted-foreground grid grid-cols-3 gap-1 text-[11px]">
            <div>
              <dt className="uppercase tracking-wide">Job</dt>
              <dd className="text-foreground">
                {(() => {
                  const jobName = jobsMap.get(s.jobId);
                  if (!jobName) return <span className="font-mono">{s.jobId}</span>;
                  if (!showIds) return jobName;
                  return (
                    <>
                      {jobName}{' '}
                      <span className="text-muted-foreground font-mono">{s.jobId}</span>
                    </>
                  );
                })()}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Max</dt>
              <dd className="text-foreground font-mono">{s.maxLevel ?? '—'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Elem</dt>
              <dd className="text-foreground">{element ?? s.element ?? '—'}</dd>
            </div>
          </dl>
          {weapon && (
            <p className="text-muted-foreground truncate text-[11px]">Needs {weapon}</p>
          )}
        </div>
      </div>
      {s.description && (
        <p className="text-muted-foreground line-clamp-3 text-[11px]">{s.description}</p>
      )}
      <HoverCardSaveFooter entityType="skill" entityId={id} />
    </div>
  );
}
