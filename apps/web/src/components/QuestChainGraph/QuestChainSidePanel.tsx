import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Coins, Sparkles } from 'lucide-react';
import { getDbClient } from '@/db';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { ExpValue } from '@/components/entity-display/ExpValue';
import { NpcLink } from '@/components/entity-links';
import { useFeatures } from '@/hooks/useFeatures';
import type { DagreNode } from './useDagreLayout';

interface Props {
  node: DagreNode | null;
}

/** Details for the quest selected in the chain graph. */
export function QuestChainSidePanel({ node }: Props) {
  return (
    <aside
      aria-label="Selected quest"
      className="border-border bg-card flex flex-col gap-4 overflow-y-auto p-4 max-md:max-h-[45%] max-md:border-t-2 md:w-[260px] md:shrink-0 md:border-l-2"
    >
      {node ? (
        <SelectedQuest key={node.questId} node={node} />
      ) : (
        <p className="text-muted-foreground text-[13px]">
          Select a quest to see its rewards and how to reach it.
        </p>
      )}
    </aside>
  );
}

function SelectedQuest({ node }: { node: DagreNode }) {
  const client = useMemo(() => getDbClient(), []);
  const questQ = useQuery({
    queryKey: ['db', 'quest', node.questId],
    queryFn: () => client.getQuest(node.questId),
  });
  const rewardsQ = useQuery({
    queryKey: ['db', 'quest', node.questId, 'rewards'],
    queryFn: () => client.getQuestRewards(node.questId),
  });
  const quest = questQ.data;
  // Same fallback as the quest page: a quest with no end NPC is turned in to its start NPC.
  const startNpcId = quest?.startNpcId ?? null;
  const endNpcId = quest ? (quest.endNpcId ?? quest.startNpcId) : null;
  const exp = rewardsQ.data?.find((r) => r.kind === 'exp');
  const meso = rewardsQ.data?.find((r) => r.kind === 'meso');
  const meta = [
    quest?.requiredLevel != null ? `Lvl ${quest.requiredLevel}+` : null,
    quest?.parent ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="sc-panel-in flex flex-1 flex-col gap-4">
      <div>
        <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-[.04em]">
          Selected
        </div>
        <h3 className="font-display mt-1 break-words text-[17px] font-semibold leading-tight">
          {node.name}
        </h3>
        {meta && <p className="text-muted-foreground mt-0.5 text-[12.5px]">{meta}</p>}
        {node.isExternal && (
          <p className="text-muted-foreground mt-1 text-[12.5px]">
            This quest belongs to another chain.
          </p>
        )}
      </div>

      {(startNpcId !== null || endNpcId !== null) && (
        <div>
          <h4 className="text-muted-foreground mb-1.5 text-[11px] font-bold uppercase tracking-[.04em]">
            NPCs
          </h4>
          <dl className="space-y-1.5 text-[13px]">
            {startNpcId !== null && <NpcRow label="Start" id={startNpcId} />}
            {endNpcId !== null && <NpcRow label="End" id={endNpcId} />}
          </dl>
        </div>
      )}

      {(exp || meso) && (
        <div>
          <h4 className="text-muted-foreground mb-1.5 text-[11px] font-bold uppercase tracking-[.04em]">
            Rewards
          </h4>
          <dl className="space-y-1.5 text-[13px]">
            {exp && (
              <div className="bg-muted flex items-center gap-2 rounded-[10px] px-2.5 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                <dt className="font-semibold">EXP</dt>
                <dd className="ml-auto font-bold tabular-nums">
                  <ExpValue exp={exp.amount ?? 0} />
                </dd>
              </div>
            )}
            {meso && (
              <div className="bg-muted flex items-center gap-2 rounded-[10px] px-2.5 py-1.5">
                <Coins className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                <dt className="font-semibold">Mesos</dt>
                <dd className="ml-auto font-bold tabular-nums">
                  {(meso.amount ?? 0).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <Link
        to={`/quests/${node.questId}`}
        className="text-primary-foreground ease-spring focus-visible:ring-primary/30 mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[image:var(--gradient-accent)] px-3.5 text-[13px] font-bold shadow-[var(--shadow-btn)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4"
      >
        Open quest
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function NpcRow({ label, id }: { label: string; id: number }) {
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();
  const npcQ = useQuery({
    queryKey: ['db', 'npc', id],
    queryFn: () => client.getNpc(id),
    enabled: features.hasNpcs,
  });
  const name = npcQ.data?.name ?? `NPC ${id}`;
  return (
    <div className="flex items-center gap-2">
      <EntityAvatar entity="npc" id={id} size={28} alt={name} />
      <dt className="text-muted-foreground w-9 shrink-0 text-[11px] font-bold uppercase">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 truncate font-semibold">
        {features.hasNpcs ? (
          <NpcLink id={id} className="hover:underline">
            {name}
          </NpcLink>
        ) : (
          name
        )}
      </dd>
    </div>
  );
}
