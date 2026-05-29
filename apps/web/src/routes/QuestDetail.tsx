import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, Coins, Copy, Package, ScrollText, Sparkles, Target, Users } from 'lucide-react';
import { DetailListSection } from '@/components/layout/DetailListSection';
import {
  DetailPageLayout,
  DetailPageLoading,
  DetailPageNotFound,
  InfoRow,
  InfoSection,
  SourceSection,
} from '@/components/layout/DetailPageLayout';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { EntityRow } from '@/components/entity-display/EntityRow';
import { ExpValue } from '@/components/entity-display/ExpValue';
import { getDbClient } from '@/db';
import type { QuestRequirementWithName, QuestRewardWithName } from '@/db';
import { NpcLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { useFeatures } from '@/hooks/useFeatures';

const BACK = { to: '/quests', label: 'Back to quests' };

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

  if (questQ.isLoading) return <DetailPageLoading entity="Quest" id={id} />;
  if (!questQ.data) return <DetailPageNotFound entity="Quest" id={id} back={BACK} />;

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
    <DetailPageLayout
      back={BACK}
      maxWidth="max-w-5xl"
      header={
        <header className="flex items-center gap-3">
          <ScrollText className="text-muted-foreground h-12 w-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-semibold tracking-tight md:text-3xl">
              {q.name}
            </h1>
            {q.parent && <p className="text-muted-foreground text-sm">{q.parent}</p>}
            <p className="text-muted-foreground font-mono text-xs">{q.id}</p>
          </div>
        </header>
      }
      aside={
        <>
          <InfoSection title="Info">
            <InfoRow label="ID" value={String(q.id)} mono />
            <InfoRow label="Area" value={q.parent ?? '—'} />
          </InfoSection>
          {(q.requiredLevel !== null || q.requiredJob !== null) && (
            <InfoSection title="Requirements">
              {q.requiredLevel !== null && (
                <InfoRow label="Req. level" value={String(q.requiredLevel)} />
              )}
              {q.requiredJob !== null && (
                <InfoRow label="Req. job" value={`bitfield ${q.requiredJob}`} />
              )}
            </InfoSection>
          )}
          <SourceSection path={q.sourcePath} />
        </>
      }
    >
      <CollectionBadgeStrip entityType="quest" entityId={q.id} />

      {q.description && (
        <p className="whitespace-pre-line text-sm leading-relaxed">{q.description}</p>
      )}

      {(q.startNpcId !== null || q.endNpcId !== null) && (
        <DetailListSection icon={Users} title="NPCs">
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
        </DetailListSection>
      )}

      <DetailListSection
        icon={Target}
        title="Requirements"
        count={requirements.length > 0 ? requirements.length : undefined}
        isEmpty={requirements.length === 0}
      >
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
      </DetailListSection>

      <DetailListSection
        icon={Award}
        title="Rewards"
        count={rewards.length > 0 ? rewards.length : undefined}
        isEmpty={rewards.length === 0}
      >
        {expReward && (
          <li className="flex items-center gap-3 px-3 py-2 text-sm">
            <Sparkles className="text-muted-foreground h-6 w-6 shrink-0" />
            <span className="flex-1">Experience</span>
            <span className="font-mono text-xs">
              <ExpValue exp={expReward.amount ?? 0} />
            </span>
          </li>
        )}
        {mesoReward && (
          <li className="flex items-center gap-3 px-3 py-2 text-sm">
            <Coins className="text-muted-foreground h-6 w-6 shrink-0" />
            <span className="flex-1">Mesos</span>
            <span className="font-mono text-xs">{(mesoReward.amount ?? 0).toLocaleString()}</span>
          </li>
        )}
        {itemRewards.map((r) => (
          <RewardRow key={`item-${r.targetId}`} r={r} linkable={features.hasItems} />
        ))}
      </DetailListSection>
    </DetailPageLayout>
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
