import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, ScrollText, Sparkles } from 'lucide-react';
import { ExpValue } from '@/components/entity-display/ExpValue';
import { getDbClient, type QuestChainRecord, type QuestRecord } from '@/db';
import { useFeatures } from '@/hooks/useFeatures';
import type { TooltipEntityConfig, TooltipField } from './types';

interface QuestExtra {
  chain: QuestChainRecord | null;
}

type QuestField = TooltipField<QuestRecord, QuestExtra>;

const fields: QuestField[] = [
  {
    key: 'parent',
    label: 'Chain / area',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.parent,
    render: ({ record }) => <>{record.parent ?? '—'}</>,
  },
  {
    key: 'requiredLevel',
    label: 'Required level',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => record.requiredLevel !== null,
    render: ({ record }) => <>Lvl {record.requiredLevel ?? '—'}+</>,
  },
  {
    key: 'chain',
    label: 'Part of chain',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ extra }) => !!extra.chain,
    render: ({ extra }) => (
      <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
        <GitBranch className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">
          Part of {extra.chain!.name} ({extra.chain!.size} quests)
        </span>
      </div>
    ),
  },
  {
    key: 'rewardExp',
    label: 'EXP reward',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'whenPresent',
    isPresent: ({ record }) => !!record.rewardExp,
    render: ({ record }) => (
      <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
        <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
        <span>
          <ExpValue exp={record.rewardExp} /> EXP
        </span>
      </div>
    ),
  },
  {
    key: 'rewardMeso',
    label: 'Meso reward',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'never',
    isPresent: ({ record }) => !!record.rewardMeso,
    render: ({ record }) => (
      <div className="text-muted-foreground text-[11px]">
        {record.rewardMeso?.toLocaleString() ?? '—'} mesos
      </div>
    ),
  },
  {
    key: 'rewardFame',
    label: 'Fame reward',
    zone: 'meta',
    metaVariant: 'line',
    defaultMode: 'never',
    isPresent: ({ record }) => !!record.rewardFame,
    render: ({ record }) => (
      <div className="text-muted-foreground text-[11px]">{record.rewardFame ?? '—'} fame</div>
    ),
  },
  {
    key: 'repeatable',
    label: 'Repeatable',
    zone: 'meta',
    metaVariant: 'inline',
    defaultMode: 'never',
    isPresent: ({ record }) => record.repeatWait !== null,
    render: ({ record }) => <>{record.repeatWait !== null ? 'Repeatable' : 'One-time'}</>,
  },
];

export const questConfig: TooltipEntityConfig<QuestRecord, QuestExtra> = {
  entity: 'quest',
  idPrefix: 'Quest',
  fetch: (id) => getDbClient().getQuest(id),
  queryKey: (id) => ['db', 'quest', id],
  useExtraData: (id) => {
    const client = useMemo(() => getDbClient(), []);
    const features = useFeatures();
    const chainQ = useQuery({
      queryKey: ['db', 'quest', id, 'chain'],
      queryFn: () => client.getChainForQuest(id),
      enabled: features.hasQuestChains,
      staleTime: 5 * 60_000,
    });
    return { chain: chainQ.data ?? null };
  },
  renderIcon: () => (
    <span className="bg-muted text-muted-foreground inline-flex h-16 w-16 shrink-0 items-center justify-center rounded">
      <ScrollText className="h-7 w-7" />
    </span>
  ),
  renderName: (record) => <div className="truncate text-sm font-semibold">{record.name}</div>,
  getSampleId: () => getDbClient().listQuests({ limit: 1 }).then((r) => r.rows[0]?.id ?? null),
  fields,
};
