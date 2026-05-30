import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, EyeOff, GitBranch, ScrollText, Sparkles } from 'lucide-react';
import { DetailListSection } from '@/components/layout/DetailListSection';
import {
  DetailPageLayout,
  DetailPageLoading,
  DetailPageNotFound,
  InfoRow,
  InfoSection,
  SourceSection,
} from '@/components/layout/DetailPageLayout';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { EntityRow } from '@/components/entity-display/EntityRow';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient, type SkillLevelRecord } from '@/db';
import { useFeatures } from '@/hooks/useFeatures';
import { useJobsMap } from '@/hooks/useJobs';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { decodeRequiredWeapon, decodeSkillElement } from '@/domain/skillElements';
import {
  buildSkillTemplateValues,
  hasSkillPlaceholders,
  renderSkillTemplate,
} from '@/domain/skillTemplate';

/**
 * Level-table column definitions. Each one binds a domain field on
 * `SkillLevelRecord` to a header label and a cell formatter. A column
 * is only rendered when at least one of the loaded rows has a non-null
 * value — otherwise it stays hidden so an attack skill doesn't show
 * empty `pad`/`mad` columns next to its damage column.
 */
const LEVEL_COLUMNS: readonly {
  key: keyof Omit<SkillLevelRecord, 'skillId' | 'level' | 'description' | 'rawJson'>;
  label: string;
  format?: (n: number) => string;
}[] = [
  { key: 'mpCost', label: 'MP' },
  { key: 'hpCost', label: 'HP cost' },
  { key: 'damagePercent', label: 'Damage %', format: (n) => `${n}%` },
  { key: 'hits', label: 'Hits' },
  { key: 'targets', label: 'Targets' },
  { key: 'durationSeconds', label: 'Duration', format: (n) => `${n}s` },
  { key: 'cooldownSeconds', label: 'Cooldown', format: (n) => `${n}s` },
  { key: 'chancePercent', label: 'Chance', format: (n) => `${n}%` },
  { key: 'pad', label: 'W. Att' },
  { key: 'mad', label: 'M. Att' },
  { key: 'pdd', label: 'W. Def' },
  { key: 'mdd', label: 'M. Def' },
  { key: 'acc', label: 'Acc' },
  { key: 'eva', label: 'Avoid' },
  { key: 'speed', label: 'Speed' },
  { key: 'jump', label: 'Jump' },
  { key: 'hp', label: 'HP' },
  { key: 'mp', label: 'MP buff' },
  { key: 'hpPercent', label: 'HP %', format: (n) => `${n}%` },
  { key: 'mpPercent', label: 'MP %', format: (n) => `${n}%` },
];

export default function SkillDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();
  const showIds = useShowEntityIds((s) => s.enabled);
  const jobsMap = useJobsMap();

  const skillQ = useQuery({
    queryKey: ['db', 'skill', id],
    queryFn: () => client.getSkill(id),
    enabled: Number.isFinite(id),
  });
  const levelsQ = useQuery({
    queryKey: ['db', 'skill', id, 'levels'],
    queryFn: () => client.getSkillLevels(id),
    enabled: Number.isFinite(id),
  });
  const prereqsQ = useQuery({
    queryKey: ['db', 'skill', id, 'prereqs'],
    queryFn: () => client.getSkillPrerequisites(id),
    enabled: Number.isFinite(id),
  });
  const requiringQ = useQuery({
    queryKey: ['db', 'skill', id, 'required-by'],
    queryFn: () => client.getSkillsRequiring(id),
    enabled: Number.isFinite(id),
  });
  const questsQ = useQuery({
    queryKey: ['db', 'skill', id, 'quests'],
    queryFn: () => client.getSkillQuests(id),
    enabled: Number.isFinite(id) && features.hasQuests,
  });

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-skill-id',
        group: 'context',
        label: 'Copy skill ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id],
  );
  useDetailPalette({
    entity: 'skill',
    id,
    name: skillQ.data?.name ?? undefined,
    items: paletteItems,
  });

  if (skillQ.isLoading) return <DetailPageLoading entity="Skill" id={id} />;
  if (skillQ.error) {
    return <p className="text-destructive text-sm">{(skillQ.error as Error).message}</p>;
  }
  if (!skillQ.data) return <DetailPageNotFound entity="Skill" id={id} />;

  const s = skillQ.data;
  const displayName = s.name ?? `Skill ${s.id}`;
  const elementLabel = decodeSkillElement(s.element);
  const weaponLabel = decodeRequiredWeapon(s.requiredWeapon);
  const levels = levelsQ.data ?? [];

  return (
    <DetailPageLayout
      header={
        <header className="flex items-center gap-3">
          <EntityIcon
            entity="skill"
            id={s.id}
            size={96}
            placeholder={Sparkles}
            alt={s.name ?? undefined}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className={
                  s.name
                    ? 'break-words text-xl font-semibold tracking-tight md:text-3xl'
                    : 'text-muted-foreground break-words text-xl font-semibold italic tracking-tight md:text-3xl'
                }
              >
                {displayName}
              </h1>
              {s.hidden && (
                <span className="inline-flex items-center gap-0.5 rounded bg-zinc-500/15 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  <EyeOff className="h-3 w-3" /> Hidden
                </span>
              )}
            </div>
            {showIds && <p className="text-muted-foreground font-mono text-xs">{s.id}</p>}
            {s.description && (
              <p className="text-muted-foreground mt-2 whitespace-pre-line text-sm leading-relaxed">
                {s.description}
              </p>
            )}
            {s.tooltip && s.tooltip !== s.description && (
              <p className="text-muted-foreground mt-1 whitespace-pre-line text-xs italic leading-relaxed">
                {s.tooltip}
              </p>
            )}
          </div>
        </header>
      }
      aside={
        <>
          {showIds && (
            <InfoSection title="Info">
              <InfoRow label="ID" value={String(s.id)} mono />
            </InfoSection>
          )}
          <InfoSection title="About">
            <InfoRow
              label="Job"
              value={
                jobsMap.get(s.jobId)
                  ? showIds
                    ? `${jobsMap.get(s.jobId)} · ${s.jobId}`
                    : (jobsMap.get(s.jobId) as string)
                  : String(s.jobId)
              }
              mono={!jobsMap.get(s.jobId)}
            />
            <InfoRow
              label="Max level"
              value={s.maxLevel !== null ? String(s.maxLevel) : '—'}
            />
            {s.masterLevel !== null && (
              <InfoRow label="Master" value={String(s.masterLevel)} />
            )}
            {(elementLabel ?? s.element) && (
              <InfoRow label="Element" value={elementLabel ?? s.element ?? ''} />
            )}
            {(weaponLabel ?? s.requiredWeapon) && (
              <InfoRow label="Weapon" value={weaponLabel ?? s.requiredWeapon ?? ''} />
            )}
            {s.hidden && <InfoRow label="Hidden" value="Yes" />}
          </InfoSection>
          <SourceSection path={s.sourcePath} />
        </>
      }
    >
      <CollectionBadgeStrip entityType="skill" entityId={s.id} />

      <DetailListSection
        icon={GitBranch}
        title="Prerequisites"
        count={prereqsQ.data?.length}
        isLoading={prereqsQ.isLoading}
        isEmpty={prereqsQ.data?.length === 0}
      >
        {(prereqsQ.data ?? []).map((p) => (
          <EntityRow
            key={p.requiredSkillId}
            entity="skill"
            id={p.requiredSkillId}
            name={p.requiredSkillName}
            meta={`Lvl ${p.requiredLevel}`}
          />
        ))}
      </DetailListSection>

      <DetailListSection
        icon={Sparkles}
        title="Required by"
        count={requiringQ.data?.length}
        isLoading={requiringQ.isLoading}
        isEmpty={requiringQ.data?.length === 0}
      >
        {(requiringQ.data ?? []).map((p) => (
          <EntityRow
            key={p.skillId}
            entity="skill"
            id={p.skillId}
            name={p.requiredSkillName}
            meta={`needs Lvl ${p.requiredLevel}`}
          />
        ))}
      </DetailListSection>

      {features.hasQuests && (
        <DetailListSection
          icon={ScrollText}
          title="Granted by quests"
          count={questsQ.data?.length}
          isLoading={questsQ.isLoading}
          isEmpty={questsQ.data?.length === 0}
          loadingLabel="Loading quests…"
        >
          {(questsQ.data ?? []).map((q) => (
            <EntityRow key={q.id} entity="quest" id={q.id} name={q.name} subtitle={q.parent} />
          ))}
        </DetailListSection>
      )}

      <LevelsTable
        levels={levels}
        isLoading={levelsQ.isLoading}
        template={s.tooltip ?? s.description ?? null}
      />
    </DetailPageLayout>
  );
}

function LevelsTable({
  levels,
  isLoading,
  template,
}: {
  levels: SkillLevelRecord[];
  isLoading: boolean;
  template: string | null;
}) {
  if (isLoading) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Per level</h2>
        <p className="text-muted-foreground text-sm">Loading levels…</p>
      </section>
    );
  }
  if (levels.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Per level</h2>
        <p className="text-muted-foreground text-sm italic">None.</p>
      </section>
    );
  }

  // Only include columns that have at least one non-null value across the
  // loaded rows. Keeps an attack skill's table from carrying empty `pad`/
  // `mad`/`speed` columns it never uses.
  const visibleColumns = LEVEL_COLUMNS.filter((col) =>
    levels.some((row) => row[col.key] !== null && row[col.key] !== undefined),
  );

  // Show the Description column when:
  //   - any level has a static `description` (older WZ pattern: `h<level>`
  //     in String.wz holds a literal string per level), OR
  //   - the parent has a templated tooltip with `#name` placeholders
  //     (modern WZ pattern: a single `h` template resolved against the
  //     row's values — see `domain/skillTemplate.ts`).
  // A non-templated tooltip is suppressed because every row would render
  // the same static string.
  const hasStaticDescriptions = levels.some((l) => l.description !== null);
  const hasTemplate = template !== null && hasSkillPlaceholders(template);
  const showDescription = hasStaticDescriptions || hasTemplate;

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">Per level</h2>
      <div className="border-border overflow-x-auto rounded-md border">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-muted-foreground sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide">
                Lvl
              </th>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className="text-muted-foreground px-3 py-2 text-right text-xs font-medium uppercase tracking-wide"
                >
                  {col.label}
                </th>
              ))}
              {showDescription && (
                <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium uppercase tracking-wide">
                  Description
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {levels.map((row) => (
              <tr key={row.level} className="border-border border-t">
                <td className="text-foreground sticky left-0 z-10 bg-background px-3 py-1.5 font-mono">
                  {row.level}
                </td>
                {visibleColumns.map((col) => {
                  const v = row[col.key];
                  if (v === null || v === undefined) {
                    return (
                      <td key={col.key} className="text-muted-foreground px-3 py-1.5 text-right">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={col.key} className="px-3 py-1.5 text-right font-mono">
                      {col.format ? col.format(v) : v.toLocaleString()}
                    </td>
                  );
                })}
                {showDescription && (
                  <td className="text-foreground max-w-md whitespace-pre-line px-3 py-1.5 leading-relaxed">
                    {row.description ??
                      (template && hasTemplate
                        ? renderSkillTemplate(template, buildSkillTemplateValues(row))
                        : '—')}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
