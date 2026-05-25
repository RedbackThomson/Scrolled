import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  Coins,
  Copy,
  Loader2,
  Package,
  ScrollText,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { EntityAvatar } from '@/components/EntityAvatar';
import { EntityRow } from '@/components/EntityRow';
import { getDbClient } from '@/db';
import type { QuestRequirementWithName, QuestRewardWithName } from '@/db';
import { NpcLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { useFeatures } from '@/lib/useFeatures';

export default function QuestDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();

  const questQ = useQuery({
    queryKey: ['db', 'quest', id],
    queryFn: () => client.getQuest(id),
    enabled: Number.isFinite(id),
  });
  const reqsQ = useQuery({
    queryKey: ['db', 'quest', id, 'requirements'],
    queryFn: () => client.getQuestRequirements(id),
    enabled: Number.isFinite(id),
  });
  const rewardsQ = useQuery({
    queryKey: ['db', 'quest', id, 'rewards'],
    queryFn: () => client.getQuestRewards(id),
    enabled: Number.isFinite(id),
  });
  const startNpcQ = useQuery({
    queryKey: ['db', 'npc', questQ.data?.startNpcId],
    queryFn: () => client.getNpc(questQ.data!.startNpcId!),
    enabled: features.hasNpcs && !!questQ.data?.startNpcId,
  });
  const endNpcQ = useQuery({
    queryKey: ['db', 'npc', questQ.data?.endNpcId],
    queryFn: () => client.getNpc(questQ.data!.endNpcId!),
    enabled:
      features.hasNpcs &&
      !!questQ.data?.endNpcId &&
      questQ.data.endNpcId !== questQ.data.startNpcId,
  });

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-quest-id',
        group: 'context',
        label: 'Copy quest ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id],
  );
  useDetailPalette({ entity: 'quest', id, name: questQ.data?.name, items: paletteItems });

  if (questQ.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading quest {id}…
      </p>
    );
  }
  if (!questQ.data) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/quests"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to quests
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Quest not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Quest <code className="font-mono">{id}</code> isn't in your library yet. It may not have
          been loaded —{' '}
          <Link to="/setup" className="text-primary hover:underline">
            visit Setup
          </Link>{' '}
          to add more files.
        </p>
      </div>
    );
  }

  const q = questQ.data;
  const requirements = reqsQ.data ?? [];
  const rewards = rewardsQ.data ?? [];
  const itemReqs = requirements.filter((r) => r.kind === 'item');
  const mobReqs = requirements.filter((r) => r.kind === 'mob');
  const questPreReqs = requirements.filter((r) => r.kind === 'questPre');
  const itemRewards = rewards.filter((r) => r.kind === 'item');
  const expReward = rewards.find((r) => r.kind === 'exp');
  const mesoReward = rewards.find((r) => r.kind === 'meso');

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        to="/quests"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to quests
      </Link>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <article className="space-y-6">
          <header className="flex items-center gap-3">
            <ScrollText className="text-muted-foreground h-12 w-12" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{q.name}</h1>
              {q.parent && <p className="text-muted-foreground text-sm">{q.parent}</p>}
              <p className="text-muted-foreground font-mono text-xs">{q.id}</p>
            </div>
          </header>

          <CollectionBadgeStrip entityType="quest" entityId={q.id} />

          {q.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed">{q.description}</p>
          )}

          {(q.startNpcId !== null || q.endNpcId !== null) && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <Users className="h-4 w-4" /> NPCs
              </h2>
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {q.startNpcId !== null && (
                  <NpcRow
                    label="Start"
                    id={q.startNpcId}
                    name={startNpcQ.data?.name ?? null}
                    linkable={features.hasNpcs}
                  />
                )}
                {q.endNpcId !== null && q.endNpcId !== q.startNpcId && (
                  <NpcRow
                    label="End"
                    id={q.endNpcId}
                    name={endNpcQ.data?.name ?? null}
                    linkable={features.hasNpcs}
                  />
                )}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Target className="h-4 w-4" /> Requirements
              {requirements.length > 0 && (
                <span className="text-muted-foreground text-xs normal-case">
                  ({requirements.length})
                </span>
              )}
            </h2>
            {requirements.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">None.</p>
            ) : (
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {itemReqs.map((r) => (
                  <RequirementRow
                    key={`item-${r.targetId}`}
                    r={r}
                    entity="item"
                    linkable={features.hasItems}
                  />
                ))}
                {mobReqs.map((r) => (
                  <RequirementRow
                    key={`mob-${r.targetId}`}
                    r={r}
                    entity="mob"
                    linkable={features.hasMobs}
                  />
                ))}
                {questPreReqs.map((r) => (
                  <RequirementRow key={`questPre-${r.targetId}`} r={r} entity="quest" linkable />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <Award className="h-4 w-4" /> Rewards
              {rewards.length > 0 && (
                <span className="text-muted-foreground text-xs normal-case">
                  ({rewards.length})
                </span>
              )}
            </h2>
            {rewards.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">None.</p>
            ) : (
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {expReward && (
                  <li className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Sparkles className="text-muted-foreground h-6 w-6 shrink-0" />
                    <span className="flex-1">Experience</span>
                    <span className="font-mono text-xs">
                      {(expReward.amount ?? 0).toLocaleString()}
                    </span>
                  </li>
                )}
                {mesoReward && (
                  <li className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Coins className="text-muted-foreground h-6 w-6 shrink-0" />
                    <span className="flex-1">Mesos</span>
                    <span className="font-mono text-xs">
                      {(mesoReward.amount ?? 0).toLocaleString()}
                    </span>
                  </li>
                )}
                {itemRewards.map((r) => (
                  <RewardRow key={`item-${r.targetId}`} r={r} linkable={features.hasItems} />
                ))}
              </ul>
            )}
          </section>
        </article>

        <aside className="border-border bg-card text-card-foreground space-y-4 self-start rounded-md border p-4 text-sm">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Info</h2>
            <dl className="divide-border divide-y">
              <Row label="ID" value={String(q.id)} mono />
              <Row label="Area" value={q.parent ?? '—'} />
            </dl>
          </section>

          {(q.requiredLevel !== null || q.requiredJob !== null) && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Requirements</h2>
              <dl className="divide-border divide-y">
                {q.requiredLevel !== null && (
                  <Row label="Req. level" value={String(q.requiredLevel)} />
                )}
                {q.requiredJob !== null && (
                  <Row label="Req. job" value={`bitfield ${q.requiredJob}`} />
                )}
              </dl>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Source</h2>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">WZ path</p>
            <code className="text-muted-foreground break-all font-mono text-xs">
              {q.sourcePath}
            </code>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NpcRow({
  label,
  id,
  name,
  linkable,
}: {
  label: string;
  id: number;
  name: string | null;
  linkable: boolean;
}) {
  const display = name ?? `NPC ${id}`;
  const rowContent = (
    <>
      <EntityAvatar entity="npc" id={id} alt={display} />
      <span className="text-muted-foreground w-12 shrink-0 text-xs uppercase tracking-wide">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate">{display}</span>
      <span className="text-muted-foreground shrink-0 font-mono text-xs">{id}</span>
    </>
  );
  return (
    <li>
      {linkable ? (
        <NpcLink id={id} className="hover:bg-accent flex items-center gap-3 px-3 py-1.5 text-sm">
          {rowContent}
        </NpcLink>
      ) : (
        <div className="flex items-center gap-3 px-3 py-1.5 text-sm">{rowContent}</div>
      )}
    </li>
  );
}

type RequirementEntity = 'item' | 'mob' | 'quest';

function RequirementRow({
  r,
  entity,
  linkable,
}: {
  r: QuestRequirementWithName;
  entity: RequirementEntity;
  linkable: boolean;
}) {
  if (r.targetId === null) {
    return (
      <li className="flex items-center gap-3 px-3 py-1.5 text-sm">
        <ScrollText className="text-muted-foreground h-6 w-6 shrink-0" />
        <span className="text-muted-foreground min-w-0 flex-1 truncate italic">
          {r.targetName ?? `#${r.targetId}`}
        </span>
        {r.amount !== null && r.amount > 1 && (
          <span className="text-muted-foreground shrink-0 font-mono text-xs">×{r.amount}</span>
        )}
      </li>
    );
  }
  return (
    <EntityRow
      entity={entity}
      id={r.targetId}
      name={r.targetName}
      meta={
        r.amount !== null && r.amount > 1 ? (
          <span className="font-mono">×{r.amount}</span>
        ) : undefined
      }
      linkable={linkable}
    />
  );
}

function RewardRow({ r, linkable }: { r: QuestRewardWithName; linkable: boolean }) {
  if (r.targetId === null) {
    return (
      <li className="flex items-center gap-3 px-3 py-1.5 text-sm">
        <Package className="text-muted-foreground h-6 w-6 shrink-0" />
        <span className="text-muted-foreground min-w-0 flex-1 truncate italic">
          {r.targetName ?? 'Item'}
        </span>
        {r.amount !== null && r.amount > 1 && (
          <span className="text-muted-foreground shrink-0 font-mono text-xs">×{r.amount}</span>
        )}
      </li>
    );
  }
  return (
    <EntityRow
      entity="item"
      id={r.targetId}
      name={r.targetName}
      meta={
        r.amount !== null && r.amount > 1 ? (
          <span className="font-mono">×{r.amount}</span>
        ) : undefined
      }
      linkable={linkable}
    />
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</dd>
    </div>
  );
}
