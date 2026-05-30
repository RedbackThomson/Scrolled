import type React from 'react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftFromLine,
  Award,
  Coins,
  Copy,
  Dices,
  GitBranch,
  Package,
  ScrollText,
  Sparkles,
  Star,
  Target,
  Users,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
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
import { RewardFilterControl } from '@/components/common/RewardFilterControl';
import { getDbClient } from '@/db';
import type { QuestRequirementWithName, QuestRewardWithName } from '@/db';
import { NpcLink, QuestChainLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { useFeatures } from '@/hooks/useFeatures';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { useCharacterPreferences } from '@/stores/characterPreferences';
import { formatDurationSeconds } from '@/lib/duration';
import { parseRewardJob, formatEquipJobs, isAnyClass } from '@/domain/equipJobs';
import {
  filterGroupedRewards,
  groupItemRewards,
  type GroupedItemReward,
} from '@/lib/questRewards';

export default function QuestDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();
  const showIds = useShowEntityIds((s) => s.enabled);

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
  // The chain a quest belongs to (or null when its WCC was size 1). Only
  // fired once the quest data has loaded so the row is real, and gated on
  // chains being a populated feature for this library.
  const chainQ = useQuery({
    queryKey: ['db', 'quest', id, 'chain'],
    queryFn: () => client.getChainForQuest(id),
    enabled: Number.isFinite(id) && features.hasQuestChains,
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

  // Character-prefs selector and reward-grouping memo live above the
  // loading guards: hooks must run in a stable order each render.
  const characterJob = useCharacterPreferences((s) => s.job);
  const characterGender = useCharacterPreferences((s) => s.gender);
  const rewards = rewardsQ.data ?? [];
  const { itemGroups, hiddenByFilter } = useMemo(() => {
    const groups = groupItemRewards(rewards.filter((r) => r.kind === 'item'));
    const filtered = filterGroupedRewards(groups, {
      job: characterJob,
      gender: characterGender,
    });
    const before = countRewardsInGroups(groups);
    const after = countRewardsInGroups(filtered);
    return { itemGroups: filtered, hiddenByFilter: Math.max(0, before - after) };
  }, [rewards, characterJob, characterGender]);

  if (questQ.isLoading) return <DetailPageLoading entity="Quest" id={id} />;
  if (!questQ.data) return <DetailPageNotFound entity="Quest" id={id} />;

  const q = questQ.data;
  const requirements = reqsQ.data ?? [];
  const itemReqs = requirements.filter((r) => r.kind === 'item');
  const mobReqs = requirements.filter((r) => r.kind === 'mob');
  const questPreReqs = requirements.filter((r) => r.kind === 'questPre');
  const expReward = rewards.find((r) => r.kind === 'exp');
  const mesoReward = rewards.find((r) => r.kind === 'meso');
  const spReward = rewards.find((r) => r.kind === 'sp');
  const fameReward = rewards.find((r) => r.kind === 'fame');
  const buffReward = rewards.find((r) => r.kind === 'buff');
  const skillReward = rewards.find((r) => r.kind === 'skill');

  // Count what the user actually sees: each scalar reward row (exp/meso/etc.)
  // plus every surviving item entry in every surviving pool.
  const visibleRewardCount =
    (expReward ? 1 : 0) +
    (mesoReward ? 1 : 0) +
    (spReward ? 1 : 0) +
    (fameReward ? 1 : 0) +
    (buffReward ? 1 : 0) +
    (skillReward ? 1 : 0) +
    countRewardsInGroups(itemGroups);
  const hasAnyReward = rewards.length > 0;

  return (
    <DetailPageLayout
      maxWidth="max-w-5xl"
      header={
        <header className="flex items-center gap-3">
          <ScrollText className="text-muted-foreground h-12 w-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-semibold tracking-tight md:text-3xl">
              {q.name}
            </h1>
            {q.parent && <p className="text-muted-foreground text-sm">{q.parent}</p>}
            {showIds && <p className="text-muted-foreground font-mono text-xs">{q.id}</p>}
          </div>
        </header>
      }
      aside={
        <>
          <InfoSection title="Info">
            {showIds && <InfoRow label="ID" value={String(q.id)} mono />}
            <InfoRow label="Area" value={q.parent ?? '—'} />
            {q.repeatWait !== null && (
              <InfoRow
                label="Repeatable"
                value={`every ${formatDurationSeconds(q.repeatWait)}`}
              />
            )}
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

      {chainQ.data && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <GitBranch className="h-4 w-4 shrink-0" />
          Part of{' '}
          <QuestChainLink id={chainQ.data.id} className="text-foreground hover:underline">
            {chainQ.data.name}
          </QuestChainLink>
          <span>({chainQ.data.size} quests)</span>
        </p>
      )}

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

      {questPreReqs.length > 0 && (
        <DetailListSection
          icon={ArrowLeftFromLine}
          title="Prerequisites"
          count={questPreReqs.length}
        >
          {questPreReqs.map(
            (r) =>
              r.targetId !== null && (
                <EntityRow
                  key={`questPre-${r.targetId}`}
                  entity="quest"
                  id={r.targetId}
                  name={r.targetName}
                  meta={r.targetLevel !== null ? `Lvl ${r.targetLevel}+` : undefined}
                />
              ),
          )}
        </DetailListSection>
      )}

      <DetailListSection
        icon={Target}
        title="Requirements"
        count={itemReqs.length + mobReqs.length > 0 ? itemReqs.length + mobReqs.length : undefined}
        isEmpty={itemReqs.length + mobReqs.length === 0}
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
      </DetailListSection>

      <DetailListSection
        icon={Award}
        title="Rewards"
        count={hasAnyReward ? visibleRewardCount : undefined}
        isEmpty={visibleRewardCount === 0}
        emptyLabel={
          hasAnyReward && hiddenByFilter > 0
            ? `Every reward is filtered out by your character preferences.`
            : 'None.'
        }
        action={hasAnyReward ? <RewardFilterControl /> : null}
      >
        {expReward && <ScalarRewardRow icon={Sparkles} label="Experience" value={<ExpValue exp={expReward.amount ?? 0} />} />}
        {mesoReward && (
          <ScalarRewardRow
            icon={Coins}
            label="Mesos"
            value={(mesoReward.amount ?? 0).toLocaleString()}
          />
        )}
        {spReward && (
          <ScalarRewardRow
            icon={Zap}
            label="Skill points"
            value={(spReward.amount ?? 0).toLocaleString()}
          />
        )}
        {fameReward && (
          <ScalarRewardRow
            icon={Star}
            label="Fame"
            value={(fameReward.amount ?? 0).toLocaleString()}
          />
        )}
        {buffReward && buffReward.targetId !== null && (
          <BuffRewardRow id={buffReward.targetId} />
        )}
        {skillReward && skillReward.targetId !== null && (
          <SkillRewardRow id={skillReward.targetId} linkable={features.hasSkills} />
        )}
        {itemGroups.map((g) => {
          // Both flags track Item.wz, but each is also gated on the matching
          // table having rows; an equip reward should follow hasEquips, not
          // hasItems, so a dump that loaded equips-only still links them.
          const rowLinkable = (r: QuestRewardWithName) =>
            r.targetEntity === 'equip' ? features.hasEquips : features.hasItems;
          return g.kind === 'guaranteed-item' ? (
            <ItemRewardRow
              key={`item-${g.reward.idx}`}
              r={g.reward}
              linkable={rowLinkable(g.reward)}
            />
          ) : (
            <RandomPoolBlock key={`pool-${g.id}`} pool={g} rowLinkable={rowLinkable} />
          );
        })}
        {hasAnyReward && visibleRewardCount > 0 && hiddenByFilter > 0 && (
          <li className="text-muted-foreground px-3 py-1.5 text-xs italic">
            {hiddenByFilter} reward{hiddenByFilter === 1 ? '' : 's'} hidden by your character
            preferences.
          </li>
        )}
      </DetailListSection>
    </DetailPageLayout>
  );
}

function countRewardsInGroups(groups: GroupedItemReward[]): number {
  let n = 0;
  for (const g of groups) {
    n += g.kind === 'guaranteed-item' ? 1 : g.rewards.length;
  }
  return n;
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
  const showIds = useShowEntityIds((s) => s.enabled);
  const display = name ?? `NPC ${id}`;
  const rowContent = (
    <>
      <EntityAvatar entity="npc" id={id} alt={display} />
      <span className="text-muted-foreground w-12 shrink-0 text-xs uppercase tracking-wide">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate">{display}</span>
      {showIds && <span className="text-muted-foreground shrink-0 font-mono text-xs">{id}</span>}
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

function ScalarRewardRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <Icon className="text-muted-foreground h-6 w-6 shrink-0" />
      <span className="flex-1">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </li>
  );
}

function BuffRewardRow({ id }: { id: number }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <Wand2 className="text-muted-foreground h-6 w-6 shrink-0" />
      <span className="flex-1">
        Buff <span className="text-muted-foreground font-mono text-xs">#{id}</span>
      </span>
    </li>
  );
}

function SkillRewardRow({ id, linkable }: { id: number; linkable: boolean }) {
  return (
    <EntityRow
      entity="skill"
      id={id}
      name={null}
      hideId={false}
      linkable={linkable}
    />
  );
}

/**
 * One guaranteed item reward. Renders the same EntityRow other detail
 * pages use, plus a trailing strip of badges (job / gender / expires)
 * pulled from the per-row WZ metadata.
 */
function ItemRewardRow({ r, linkable }: { r: QuestRewardWithName; linkable: boolean }) {
  const badges = <RewardBadges reward={r} />;
  if (r.targetId === null) {
    return (
      <li className="flex items-center gap-3 px-3 py-1.5 text-sm">
        <Package className="text-muted-foreground h-6 w-6 shrink-0" />
        <span className="text-muted-foreground min-w-0 flex-1 truncate italic">
          {r.targetName ?? 'Item'}
        </span>
        {badges}
        {r.amount !== null && r.amount > 1 && (
          <span className="text-muted-foreground shrink-0 font-mono text-xs">×{r.amount}</span>
        )}
      </li>
    );
  }
  return (
    <EntityRow
      entity={r.targetEntity ?? 'item'}
      id={r.targetId}
      name={r.targetName}
      meta={
        <span className="flex items-center gap-1.5">
          {badges}
          {r.amount !== null && r.amount > 1 && (
            <span className="font-mono">×{r.amount}</span>
          )}
        </span>
      }
      linkable={linkable && r.targetEntity !== null}
    />
  );
}

/**
 * One random-reward pool. Renders as a single nested `<li>` to fit inside
 * DetailListSection's `<ul>`; inside, an inline header announces "Choose
 * one of these" and each member sits with its weight percentage.
 */
function RandomPoolBlock({
  pool,
  rowLinkable,
}: {
  pool: { rewards: QuestRewardWithName[]; totalWeight: number };
  rowLinkable: (r: QuestRewardWithName) => boolean;
}) {
  return (
    <li className="space-y-1.5 px-3 py-2 text-sm">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs uppercase tracking-wide">
        <Dices className="h-3.5 w-3.5" />
        Choose one
        <span className="text-muted-foreground/70 normal-case">
          ({pool.rewards.length})
        </span>
      </div>
      <ul className="border-border bg-background divide-border divide-y rounded-md border">
        {pool.rewards.map((r) => (
          <PoolEntry
            key={`pool-entry-${r.idx}-${r.targetId}`}
            reward={r}
            totalWeight={pool.totalWeight}
            linkable={rowLinkable(r)}
          />
        ))}
      </ul>
    </li>
  );
}

function PoolEntry({
  reward,
  totalWeight,
  linkable,
}: {
  reward: QuestRewardWithName;
  totalWeight: number;
  linkable: boolean;
}) {
  const weight = reward.prop ?? 0;
  const pct =
    totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : null;
  const meta = (
    <span className="flex items-center gap-1.5">
      <RewardBadges reward={reward} omitJobIfImpliedByAny={false} />
      {reward.amount !== null && reward.amount > 1 && (
        <span className="font-mono">×{reward.amount}</span>
      )}
      {pct !== null && (
        <span className="text-primary bg-primary/10 inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px]">
          {pct}%
        </span>
      )}
    </span>
  );
  if (reward.targetId === null) {
    return (
      <li className="flex items-center gap-3 px-3 py-1.5 text-sm">
        <Package className="text-muted-foreground h-6 w-6 shrink-0" />
        <span className="text-muted-foreground min-w-0 flex-1 truncate italic">
          {reward.targetName ?? 'Item'}
        </span>
        {meta}
      </li>
    );
  }
  return (
    <EntityRow
      entity={reward.targetEntity ?? 'item'}
      id={reward.targetId}
      name={reward.targetName}
      meta={meta}
      linkable={linkable && reward.targetEntity !== null}
    />
  );
}

/**
 * Small badge strip surfaced on reward rows for any non-default WZ fields:
 * class/gender restrictions and (rarely) an expiration period. Omitted
 * entirely when the row has no restrictions worth surfacing.
 */
function RewardBadges({
  reward,
  omitJobIfImpliedByAny = true,
}: {
  reward: QuestRewardWithName;
  /** When true, suppress the job badge for unrestricted rewards. Pool
   *  entries pass false so a mixed pool always shows who-gets-what. */
  omitJobIfImpliedByAny?: boolean;
}) {
  const badges: React.ReactNode[] = [];
  if (reward.job !== null && reward.job !== 0) {
    const classes = parseRewardJob(reward.job);
    if (!omitJobIfImpliedByAny || !isAnyClass(classes)) {
      badges.push(
        <Badge key="job" tone="emerald" title={`Restricted to ${formatEquipJobs(classes)}`}>
          {formatEquipJobs(classes)}
        </Badge>,
      );
    }
  }
  if (reward.gender === 0 || reward.gender === 1) {
    badges.push(
      <Badge key="gender" tone="rose" title="Gender-restricted">
        {reward.gender === 0 ? 'Male' : 'Female'}
      </Badge>,
    );
  }
  if (reward.period !== null && reward.period > 0) {
    // WZ stores `period` in minutes for quest rewards. Convert to seconds
    // so formatDurationSeconds can pick the largest tidy unit.
    badges.push(
      <Badge key="period" tone="amber" title="Time-limited reward">
        {formatDurationSeconds(reward.period * 60)}
      </Badge>,
    );
  }
  if (badges.length === 0) return null;
  return <span className="flex flex-wrap items-center gap-1">{badges}</span>;
}

type BadgeTone = 'emerald' | 'rose' | 'amber';

function Badge({
  tone,
  children,
  title,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  title?: string;
}) {
  const cls = {
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}
      title={title}
    >
      {children}
    </span>
  );
}
