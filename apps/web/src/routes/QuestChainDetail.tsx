import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Copy,
  Eye,
  GitBranch,
  Layers,
  Network,
  ScrollText,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DetailListSection } from '@/components/layout/DetailListSection';
import {
  DetailPageLayout,
  DetailPageLoading,
  DetailPageNotFound,
  InfoRow,
  InfoSection,
} from '@/components/layout/DetailPageLayout';
import { QuestLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import type { QuestChainMemberWithName } from '@/db';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { QuestChainGraphModal } from '@/components/QuestChainGraph';

export default function QuestChainDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const showIds = useShowEntityIds((s) => s.enabled);
  const [graphOpen, setGraphOpen] = useState(false);
  // When true, the list and graph hide optional quests entirely so only
  // the "must do" route to the final quest is visible. Default off so the
  // chain reads as complete out of the box.
  const [criticalOnly, setCriticalOnly] = useState(false);

  const chainQ = useQuery({
    queryKey: ['db', 'quest-chain', id],
    queryFn: () => client.getQuestChain(id),
    enabled: Number.isFinite(id),
  });

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-chain-id',
        group: 'context',
        label: 'Copy chain ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
      {
        id: 'view-chain-graph',
        group: 'context',
        label: 'View chain as graph',
        keywords: ['graph', 'visualise', 'visualize', 'diagram'],
        icon: Network,
        onSelect: () => setGraphOpen(true),
      },
    ],
    [id],
  );
  useDetailPalette({
    entity: 'questChain',
    id,
    name: chainQ.data?.chain.name,
    items: paletteItems,
  });

  if (chainQ.isLoading) return <DetailPageLoading entity="Quest Chain" id={id} />;
  if (!chainQ.data) return <DetailPageNotFound entity="Quest Chain" id={id} />;

  const { chain, members, edges } = chainQ.data;
  const roots = members.filter((m) => m.isRoot);
  const criticalCount = members.filter((m) => m.isCritical).length;
  const optionalCount = members.length - criticalCount;

  // When the toggle is on, drop optional quests from both the list and the
  // graph. Persisted stages are preserved by construction (an optional
  // quest can never sit on a shorter path to the final, so removing it
  // never shrinks a critical quest's BFS distance), so we just filter the
  // existing rows — no recompute needed.
  const visibleMembers = criticalOnly ? members.filter((m) => m.isCritical) : members;
  const visibleEdges = criticalOnly
    ? edges.filter((e) => {
        const from = members.find((m) => m.questId === e.fromQuestId);
        const to = members.find((m) => m.questId === e.toQuestId);
        return from?.isCritical && to?.isCritical;
      })
    : edges;

  // Group visible members by depth. Within a depth, critical first, then
  // roots, then by name. Quests inside a cyclic SCC stay with their depth
  // bucket but render an inline "in cycle" badge.
  const byDepth = new Map<number, QuestChainMemberWithName[]>();
  for (const m of visibleMembers) {
    const arr = byDepth.get(m.depth);
    if (arr) arr.push(m);
    else byDepth.set(m.depth, [m]);
  }
  const depths = [...byDepth.keys()].sort((a, b) => a - b);

  return (
    <DetailPageLayout
      maxWidth="max-w-5xl"
      header={
        <header className="flex items-center gap-3">
          <GitBranch className="text-muted-foreground h-12 w-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-semibold tracking-tight md:text-3xl">
              {chain.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {chain.size} quests · {chain.maxDepth} stages
              {chain.rootCount > 1 ? ` · ${chain.rootCount} starts` : ''}
              {chain.hasCycles ? ' · contains loop' : ''}
              {chain.parent ? ` · ${chain.parent}` : ''}
            </p>
            {showIds && <p className="text-muted-foreground font-mono text-xs">{chain.id}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            {optionalCount > 0 && (
              <button
                type="button"
                onClick={() => setCriticalOnly((v) => !v)}
                className={cn(
                  'border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm',
                  criticalOnly && 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
                )}
                title={
                  criticalOnly
                    ? `Showing the critical path only (${criticalCount} of ${chain.size} quests). Click to show everything.`
                    : `Hide ${optionalCount} optional quest${optionalCount === 1 ? '' : 's'} and show only the critical path.`
                }
                aria-pressed={criticalOnly}
              >
                {criticalOnly ? <Eye className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                {criticalOnly ? 'Show all' : 'Critical path'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setGraphOpen(true)}
              className="border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
            >
              <Network className="h-4 w-4" />
              View graph
            </button>
          </div>
        </header>
      }
      aside={
        <>
          <InfoSection title="Info">
            {showIds && <InfoRow label="ID" value={String(chain.id)} mono />}
            <InfoRow label="Quests" value={String(chain.size)} />
            <InfoRow label="Max stage" value={String(chain.maxDepth)} />
            <InfoRow label="Starting quests" value={String(chain.rootCount)} />
            {optionalCount > 0 && (
              <>
                <InfoRow label="Critical" value={String(criticalCount)} />
                <InfoRow label="Optional" value={String(optionalCount)} />
              </>
            )}
            <InfoRow label="Loop" value={chain.hasCycles ? 'Yes' : 'No'} />
            {chain.cycleCount > 1 && <InfoRow label="Loops" value={String(chain.cycleCount)} />}
            {chain.parent && <InfoRow label="Area" value={chain.parent} />}
          </InfoSection>
        </>
      }
    >
      <CollectionBadgeStrip entityType="questChain" entityId={chain.id} />

      {chain.rootCount > 1 && (
        <p className="text-muted-foreground text-sm">
          Multiple starting quests:{' '}
          {roots.map((r, i) => (
            <span key={r.questId}>
              <QuestLink id={r.questId} className="hover:underline">
                {r.questName}
              </QuestLink>
              {i < roots.length - 1 && ', '}
            </span>
          ))}
          .
        </p>
      )}

      {chain.hasCycles && (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This chain contains {chain.cycleCount > 1 ? `${chain.cycleCount} loops` : 'a loop'} —
            quests in the loop reference each other as prerequisites, so the chain may have no valid
            starting point.
          </span>
        </p>
      )}

      {depths.map((d) => {
        const group = byDepth.get(d)!;
        return (
          <DetailListSection key={d} icon={Layers} title={`Stage ${d}`} count={group.length}>
            {group.map((m) => (
              <MemberRow
                key={m.questId}
                member={m}
                isPrimaryRoot={m.questId === chain.representativeRootId}
              />
            ))}
          </DetailListSection>
        );
      })}

      <QuestChainGraphModal
        open={graphOpen}
        onClose={() => setGraphOpen(false)}
        chain={chain}
        members={visibleMembers}
        edges={visibleEdges}
      />
    </DetailPageLayout>
  );
}

function MemberRow({
  member,
  isPrimaryRoot,
}: {
  member: QuestChainMemberWithName;
  isPrimaryRoot: boolean;
}) {
  const showIds = useShowEntityIds((s) => s.enabled);
  const optional = !member.isCritical;
  return (
    <li>
      <QuestLink
        id={member.questId}
        className={cn(
          'hover:bg-accent flex items-center gap-3 px-3 py-1.5 text-sm',
          optional && 'text-muted-foreground',
        )}
      >
        <ScrollText
          className={cn('h-6 w-6 shrink-0', optional ? 'opacity-60' : 'text-muted-foreground')}
        />
        <span className={cn('min-w-0 flex-1 truncate', optional && 'italic')}>
          {member.questName}
        </span>
        {optional && (
          <span
            className="border-border text-muted-foreground shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
            title="Skippable when racing toward the final quest"
          >
            Optional
          </span>
        )}
        {member.isRoot && (
          <span
            className="text-muted-foreground shrink-0 text-[10px] uppercase tracking-wide"
            title={
              isPrimaryRoot
                ? 'Primary starting quest for this chain'
                : 'A starting quest in this chain'
            }
          >
            {isPrimaryRoot ? 'Primary start' : 'Start'}
          </span>
        )}
        {member.sccId !== null && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertTriangle className="h-3 w-3" />
            Loop {member.sccId}
          </span>
        )}
        {showIds && (
          <span className="text-muted-foreground shrink-0 font-mono text-xs">{member.questId}</span>
        )}
      </QuestLink>
    </li>
  );
}
